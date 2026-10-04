"""Scoped release of frozen Three-Dragon assets; inspect is read-only.

The applying operator supplies a newly captured baseline. This does not modify
nginx, systemd units, relay/card files, Suite manifests or private game records.
SQLite backup is retained on the server with root-only permissions. Rollback
restores code/assets and never overwrites the live database.
"""
import argparse
import ctypes
import datetime
import fcntl
import hashlib
import json
import os
import pathlib
import re
import shutil
import sqlite3
import stat
import subprocess
import tarfile
import time
import urllib.request
import uuid

BASE = pathlib.Path('/var/www/obr-plugins')
SERVER = pathlib.Path('/opt/obr-three-dragon/server.mjs')
DATABASE = pathlib.Path('/var/lib/obr-three-dragon/game.sqlite')
PRIVATE = pathlib.Path('/var/backups/three-dragon-releases')
UPLOAD = pathlib.Path('/var/tmp/three-dragon-release')
TARGETS = ('three-dragon-ante-dev', 'three-dragon-ante', 'suite-dev', 'suite')
PROTECTED_FILES = (
    '/etc/nginx/sites-enabled/obr-plugins',
    '/etc/systemd/system/obr-three-dragon.service',
    '/opt/obr-workbench-relay-dev/server.mjs',
    '/opt/obr-workbench-relay-dev/documents.mjs',
    '/opt/obr-workbench-relay-dev/patches.mjs',
)
PROTECTED_SERVICES = ('nginx', 'obr-workbench-relay-dev')
RELEASE_ID = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$')
SHA = re.compile(r'^[0-9a-f]{64}$')
HOST_PATH = re.compile(r'(?:settings\.html|assets/[A-Za-z0-9_.-]+\.(?:js|css)|three-dragon-link-source-[a-f0-9]{12}\.zip|workbench/(?:index\.html|sw\.js|assets/[A-Za-z0-9_.-]+\.(?:js|css)|three-dragon-link-source-[a-f0-9]{12}\.zip)|workbench-panels/(?:settings\.html|settings-[A-Za-z0-9_.-]+\.js))')
libc = ctypes.CDLL(None, use_errno=True)


def digest(file):
    value = hashlib.sha256()
    with file.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(chunk)
    return value.hexdigest()


def safe_relative(value):
    if not isinstance(value, str) or not value or '\\' in value or ':' in value:
        raise ValueError('Invalid relative path')
    parts = value.split('/')
    if any(part in ('', '.', '..') for part in parts):
        raise ValueError('Unsafe relative path: ' + value)
    if any(part in ('.git', '.claude', '.local-evidence', '.local-data') or part.startswith('.env') for part in parts) or '.sqlite' in value:
        raise ValueError('Private file is not allowed: ' + value)
    return pathlib.PurePosixPath(value)


def no_symlink_tree(directory):
    if directory.is_symlink() or not directory.is_dir():
        raise ValueError('Expected a real directory: ' + str(directory))
    for path in directory.rglob('*'):
        if path.is_symlink() or not (path.is_file() or path.is_dir()):
            raise ValueError('Symlink/special file found: ' + str(path))


def tree_digest(directory):
    if not directory.exists():
        if directory.is_symlink():
            raise ValueError('Dangling symlink is not an absent target')
        return None
    no_symlink_tree(directory)
    def attributes(path):
        data = path.stat()
        return {'mode': stat.S_IMODE(data.st_mode), 'uid': data.st_uid, 'gid': data.st_gid}
    files = {path.relative_to(directory).as_posix(): {'sha256': digest(path), **attributes(path)} for path in sorted(directory.rglob('*')) if path.is_file()}
    directories = {'.': attributes(directory), **{path.relative_to(directory).as_posix(): attributes(path) for path in sorted(directory.rglob('*')) if path.is_dir()}}
    return {'files': files, 'directories': directories}


def file_state(path):
    data = path.stat()
    return {'sha256': digest(path), 'mode': stat.S_IMODE(data.st_mode), 'uid': data.st_uid, 'gid': data.st_gid}


def copy_preserving(source, destination):
    source = pathlib.Path(source)
    shutil.copy2(source, destination)
    data = source.stat()
    os.chown(destination, data.st_uid, data.st_gid)
    shutil.copystat(source, destination)
    return destination


def clone_tree(source, destination):
    shutil.copytree(source, destination, copy_function=copy_preserving)
    for original in [source, *[item for item in source.rglob('*') if item.is_dir()]]:
        copied = destination / original.relative_to(source)
        data = original.stat()
        os.chown(copied, data.st_uid, data.st_gid)
        shutil.copystat(original, copied)


def command(*args):
    return subprocess.check_output(args, text=True).strip()


def require_real_ancestry(path):
    # Check lexical parents before resolve(), which would hide an alias.
    for part in [*reversed(path.parents), path]:
        if part.is_symlink():
            raise ValueError('Control path cannot contain a symlink: ' + str(part))
        if part != path and part.exists() and not part.is_dir():
            raise ValueError('Control path parent is not a directory: ' + str(part))


def validate_control_paths():
    for path in (BASE, BASE / '.three-dragon-releases', PRIVATE, UPLOAD, SERVER):
        require_real_ancestry(path)
    if SERVER.exists() and not SERVER.is_file():
        raise ValueError('Server bundle must be a regular file')


def snapshot():
    validate_control_paths()
    if BASE.is_symlink() or not BASE.is_dir():
        raise ValueError('Static root is not a real directory')
    return {
        'format': 1, 'staticRoot': str(BASE),
        'targets': {name: tree_digest(BASE / name) for name in TARGETS},
        'protected': {
            'card': tree_digest(BASE / 'card'),
            'files': {name: file_state(pathlib.Path(name)) for name in PROTECTED_FILES},
            'services': {name: command('systemctl', 'show', name, '-p', 'ActiveState', '-p', 'ActiveEnterTimestampMonotonic', '-p', 'MainPID') for name in PROTECTED_SERVICES},
        },
        # is-active exits 3 when a candidate fails to start. show must still
        # return a readable state so automatic restore can replace that bundle.
        'server': {**file_state(SERVER), 'active': command('systemctl', 'show', 'obr-three-dragon', '-p', 'ActiveState', '--value')},
    }


def require_equal(actual, expected, description):
    if actual != expected:
        raise RuntimeError(description + ' changed; capture and review a fresh baseline before release')


def atomic_json(file, data, private=False):
    temporary = file.with_name(file.name + '.new')
    with temporary.open('w', encoding='utf-8') as stream:
        stream.write(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
        stream.flush()
        os.fsync(stream.fileno())
    os.chmod(temporary, 0o600 if private else 0o644)
    os.replace(temporary, file)
    sync_directory(file.parent)


def sync_directory(path):
    if os.name == 'posix':
        descriptor = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)


def exchange(a, b):
    # Both paths stay on the static filesystem. Linux RENAME_EXCHANGE presents
    # one complete directory to readers throughout the switch.
    if not hasattr(libc, 'renameat2'):
        raise RuntimeError('Atomic directory exchange is unavailable')
    result = libc.renameat2(-100, os.fsencode(a), -100, os.fsencode(b), 2)
    if result:
        error = ctypes.get_errno()
        raise OSError(error, os.strerror(error))
    sync_directory(a.parent)
    if a.parent != b.parent:
        sync_directory(b.parent)


def health():
    with urllib.request.urlopen('http://127.0.0.1:5013/three-dragon-api/v1/health', timeout=2) as response:
        data = json.load(response)
        if response.status != 200 or data.get('ok') is not True or data.get('protocol') != 1:
            raise RuntimeError('Unexpected service health')


def restart_and_check():
    subprocess.run(['systemctl', 'restart', 'obr-three-dragon'], check=True)
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        try:
            health()
            return
        except Exception:
            time.sleep(0.5)
    raise RuntimeError('Three-Dragon service did not recover within 30 seconds')


def replace_server(source):
    temporary = SERVER.with_name('server.mjs.three-dragon-new-' + uuid.uuid4().hex)
    if temporary.exists() or temporary.is_symlink():
        raise RuntimeError('Server replacement temporary file already exists')
    shutil.copy2(source, temporary)
    original = SERVER.stat()
    os.chown(temporary, original.st_uid, original.st_gid)
    os.chmod(temporary, stat.S_IMODE(original.st_mode))
    if os.name == 'posix':
        with temporary.open('rb') as stream:
            os.fsync(stream.fileno())
    os.replace(temporary, SERVER)
    sync_directory(SERVER.parent)


def backup_database(destination):
    # This private server-local backup is never included in package or stdout.
    deadline = time.monotonic() + 30
    def progress(status, remaining, total):
        if time.monotonic() > deadline:
            raise RuntimeError('Private SQLite backup exceeded 30 seconds')
    with sqlite3.connect('file:' + str(DATABASE) + '?mode=ro', uri=True, timeout=5) as source:
        with sqlite3.connect(destination) as target:
            source.backup(target, pages=256, progress=progress, sleep=0.1)
    os.chmod(destination, 0o600)


def package_manifest(archive, destination):
    expected = {'release-manifest.json'}
    with tarfile.open(archive, 'r:gz') as package:
        entries = package.getmembers()
        names = set()
        for entry in entries:
            safe_relative(entry.name)
            if not entry.isfile() or entry.name in names:
                raise ValueError('Package contains a duplicate or non-regular entry')
            names.add(entry.name)
        if 'release-manifest.json' not in names:
            raise ValueError('Release manifest is missing')
        manifest = json.load(package.extractfile('release-manifest.json'))
        if manifest.get('format') != 1 or manifest.get('api') != '/three-dragon-api/v1' or manifest.get('repository') != 'FullPeople/three-dragon-ante':
            raise ValueError('Unexpected release format/repository/API')
        if not re.fullmatch(r'[0-9a-f]{40}', manifest.get('source', '')):
            raise ValueError('Invalid frozen source commit')
        if sorted(item.get('name') for item in manifest['targets']) != sorted(TARGETS):
            raise ValueError('Exactly four known targets are required')
        records = {}
        host = manifest.get('hostOverlay') or {}
        if host and (host.get('mode') != 'website-link-only' or host.get('website') != 'https://obr.dnd.center/three-dragon-ante/'):
            raise ValueError('Unsupported host overlay')
        host_records = {}
        for record in host.get('outputs', []):
            filename = safe_relative(record['path']).as_posix()
            target, path = filename.split('/', 1)
            if target not in ('suite', 'suite-dev') or not HOST_PATH.fullmatch(path) or filename in host_records:
                raise ValueError('Unexpected or duplicate host output')
            host_records[filename] = record
        for target in manifest['targets']:
            name = target['name']
            if target['kind'] != ('suite-overlay' if name.startswith('suite') else 'independent'):
                raise ValueError('Incorrect target kind')
            for record in target['files']:
                path = safe_relative(record['path']).as_posix()
                host_record = host_records.get(name + '/' + path)
                declared_host = host_record and host_record['sha256'] == record['sha256']
                if name == 'suite-dev' and not re.fullmatch(r'workbench-panels/(?:table\.html|assets/[A-Za-z0-9_.-]+)', path) and not declared_host:
                    raise ValueError('Suite-dev file is outside the table overlay')
                if name == 'suite' and not re.fullmatch(r'(?:three-dragon-ante\.html|three-dragon-assets/[A-Za-z0-9_.-]+)', path) and not declared_host:
                    raise ValueError('Stable Suite file is outside the table overlay')
                filename = name + '/' + path
                if filename in records:
                    raise ValueError('Duplicate manifest file')
                records[filename] = record
            if not target['files']:
                raise ValueError('An empty target cannot be released')
        if not set(host_records).issubset(records):
            raise ValueError('Declared host outputs must be present in the release')
        for record in (manifest['server'], manifest['sourceArchive']):
            path = safe_relative(record['path']).as_posix()
            if path in records:
                raise ValueError('Duplicate server/source manifest file')
            records[path] = record
        if manifest['server']['path'] != 'server/server.mjs' or not re.fullmatch(r'three-dragon-source-[0-9a-f]{12}\.zip', manifest['sourceArchive']['path']):
            raise ValueError('Unexpected server/source location')
        expected.update(records)
        if names != expected:
            raise ValueError('Package files do not exactly match the manifest')
        if destination.exists():
            raise ValueError('Extraction destination must be new')
        destination.mkdir(parents=True)
        for entry in entries:
            output = destination / entry.name
            output.parent.mkdir(parents=True, exist_ok=True)
            with package.extractfile(entry) as source, output.open('xb') as stream:
                shutil.copyfileobj(source, stream)
            os.chmod(output, 0o644)
        for path, record in records.items():
            file = destination / path
            if not SHA.fullmatch(record.get('sha256', '')) or digest(file) != record['sha256'] or ('size' in record and file.stat().st_size != record['size']):
                raise ValueError('SHA/size mismatch: ' + path)
        return manifest


def existing_parent(path):
    while not path.exists():
        path = path.parent
    return path


def space_guard(archive, baseline):
    # No staging writes occur until both filesystems can hold complete backups
    # plus payload and still retain at least 512 MiB for live service writes.
    with tarfile.open(archive, 'r:gz') as package:
        entries = package.getmembers()
        for entry in entries:
            safe_relative(entry.name)
            if not entry.isfile():
                raise ValueError('Package contains a non-regular entry')
        expanded = sum(entry.size for entry in entries)
        source_size = sum(entry.size for entry in entries if re.fullmatch(r'three-dragon-source-[0-9a-f]{12}\.zip', entry.name))
    old_size = sum(path.stat().st_size for name in TARGETS if baseline['targets'][name] is not None for path in (BASE / name).rglob('*') if path.is_file())
    old_entries = sum(len(item['files']) + len(item['directories']) for item in baseline['targets'].values() if item is not None)
    static_needed = expanded + 2 * old_size + len(TARGETS) * source_size + (len(entries) + 2 * old_entries) * 4096
    wal = DATABASE.with_name(DATABASE.name + '-wal')
    private_needed = DATABASE.stat().st_size + (wal.stat().st_size if wal.exists() else 0) + SERVER.stat().st_size + 16 * 1024 * 1024
    sites_parent, private_parent = existing_parent(BASE), existing_parent(PRIVATE)
    allocations = [(sites_parent, static_needed), (private_parent, private_needed)]
    grouped = {}
    for parent, needed in allocations:
        device = parent.stat().st_dev
        grouped.setdefault(device, [parent, 0])[1] += needed
    for parent, needed in grouped.values():
        reserve = max(512 * 1024 * 1024, needed // 10)
        free = shutil.disk_usage(parent).free
        if free < needed + reserve:
            raise RuntimeError(f'Insufficient release space at {parent}: free={free}, required={needed + reserve}; no staging or service changes made')


def release_paths(release_id):
    if not RELEASE_ID.fullmatch(release_id):
        raise ValueError('Invalid release ID')
    validate_control_paths()
    work, private = BASE / '.three-dragon-releases' / release_id, PRIVATE / release_id
    require_real_ancestry(work)
    require_real_ancestry(private)
    return work, private


def static_parents(stage, relative):
    current = stage
    for component in relative.parts:
        current /= component
        if current.exists():
            if current.is_symlink() or not current.is_dir():
                raise ValueError('Static parent is not a real directory')
        else:
            current.mkdir()
            os.chmod(current, 0o755)


def copy_overlay(payload, stage, target, source, manifest):
    for record in target['files']:
        path = safe_relative(record['path'])
        destination = stage / path
        static_parents(stage, path.parent)
        if destination.is_symlink() or destination.is_dir():
            raise RuntimeError('Existing target file is not regular')
        shutil.copy2(payload / target['name'] / path, destination)
        os.chmod(destination, 0o644)
    archive = manifest['sourceArchive']
    shutil.copy2(payload / archive['path'], stage / archive['path'])
    os.chmod(stage / archive['path'], 0o644)
    atomic_json(stage / 'three-dragon-release.json', {
        'repository': manifest['repository'], 'source': manifest['source'],
        'version': target.get('version', manifest['version']), 'target': target['name'],
        'api': manifest['api'], 'sourceArchive': archive,
        'suiteSource': target.get('suiteSource'),
    })
    no_symlink_tree(stage)


def validate_host_baseline(manifest, baseline):
    host = manifest.get('hostOverlay') or {}
    for record in host.get('outputs', []):
        target, path = safe_relative(record['path']).as_posix().split('/', 1)
        actual = ((baseline['targets'].get(target) or {}).get('files') or {}).get(path)
        before = record.get('beforeSha256')
        if before is None:
            if actual is not None and actual['sha256'] != record['sha256']:
                raise ValueError('New host asset conflicts with current live content: ' + record['path'])
        elif not actual or actual['sha256'] != before:
            raise ValueError('Host entry drifted from the reviewed source: ' + record['path'])
    for record in host.get('unchanged', []) + host.get('preservedDependencies', []):
        target, path = safe_relative(record['path']).as_posix().split('/', 1)
        if target not in ('suite', 'suite-dev') or not SHA.fullmatch(record.get('sha256', '')):
            raise ValueError('Invalid reused host dependency')
        actual = ((baseline['targets'].get(target) or {}).get('files') or {}).get(path)
        if not actual or actual['sha256'] != record['sha256']:
            raise ValueError('Reused host dependency drifted: ' + record['path'])


def apply_release(args):
    validate_control_paths()
    require_real_ancestry(pathlib.Path(args.archive))
    require_real_ancestry(pathlib.Path(args.baseline))
    archive = pathlib.Path(args.archive).resolve()
    baseline_file = pathlib.Path(args.baseline).resolve()
    for file in (archive, baseline_file):
        if not file.is_relative_to(UPLOAD.resolve()) or not file.is_file():
            raise ValueError('Uploaded inputs must be regular files under ' + str(UPLOAD))
    if not SHA.fullmatch(args.sha256) or digest(archive) != args.sha256:
        raise ValueError('Uploaded release archive SHA does not match the local preparation receipt')
    baseline = json.loads(baseline_file.read_text(encoding='utf-8'))
    require_equal(snapshot(), baseline, 'Online baseline')
    health()
    node_version = command('/usr/local/bin/node', '--version')
    match = re.fullmatch(r'v(\d+)\.(\d+)\.(\d+)', node_version)
    if not match or tuple(map(int, match.groups())) < (22, 13, 1):
        raise RuntimeError('Production service requires the validated Node 22.13.1 runtime or newer; local builds use Node 22.17+')
    space_guard(archive, baseline)
    work, private = release_paths(args.release_id)
    if work.exists() or private.exists():
        raise RuntimeError('A release ID can only be used once; old evidence is retained')
    private.mkdir(parents=True, mode=0o700)
    os.chmod(PRIVATE, 0o700)
    os.chmod(private, 0o700)
    work.mkdir(parents=True)
    os.chmod(BASE / '.three-dragon-releases', 0o700)
    os.chmod(work, 0o700)
    payload = work / 'payload'
    manifest = package_manifest(archive, payload)
    validate_host_baseline(manifest, baseline)
    subprocess.run(['/usr/local/bin/node', '--check', str(payload / manifest['server']['path'])], check=True, capture_output=True)
    receipt = {'format': 1, 'id': args.release_id, 'source': manifest['source'], 'status': 'preparing', 'baseline': baseline,
               'createdUTC': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'targets': {}, 'serverInstalled': False}
    receipt_file = private / 'receipt.json'
    atomic_json(receipt_file, receipt, private=True)
    stage_root = work / 'stage'
    rollback_root = work / 'rollback'
    stage_root.mkdir()
    rollback_root.mkdir()
    for target in manifest['targets']:
        name = target['name']
        stage = stage_root / name
        if baseline['targets'][name] is None:
            stage.mkdir()
            os.chmod(stage, 0o755)
        else:
            clone_tree(BASE / name, stage)
            clone_tree(BASE / name, rollback_root / name)
        copy_overlay(payload, stage, target, manifest['source'], manifest)
        receipt['targets'][name] = {'previouslyAbsent': baseline['targets'][name] is None, 'newFiles': tree_digest(stage), 'switched': False}
    shutil.copy2(SERVER, private / 'server.mjs.previous')
    backup_database(private / 'game.sqlite.private-backup')
    # The initial snapshot can drift while large Suite trees are copied. Guard
    # again immediately before the first mutation and before each target switch.
    require_equal(snapshot(), baseline, 'Online baseline before switching')
    atomic_json(receipt_file, receipt, private=True)
    try:
        receipt['serverInstalled'] = True
        receipt['serverNewSha256'] = manifest['server']['sha256']
        receipt['serverNewState'] = {**{key: value for key, value in baseline['server'].items() if key != 'active'}, 'sha256': manifest['server']['sha256']}
        atomic_json(receipt_file, receipt, private=True)
        replace_server(payload / manifest['server']['path'])
        require_equal(file_state(SERVER), receipt['serverNewState'], 'New server bundle permissions and contents')
        restart_and_check()
        for target in manifest['targets']:
            name = target['name']
            require_equal(tree_digest(BASE / name), baseline['targets'][name], name + ' before switching')
            stage = stage_root / name
            # Backups are already complete; persist intent before the atomic
            # change. Recovery compares current hashes with old/new snapshots.
            receipt['targets'][name]['switched'] = True
            atomic_json(receipt_file, receipt, private=True)
            if receipt['targets'][name]['previouslyAbsent']:
                os.replace(stage, BASE / name)
            else:
                exchange(stage, BASE / name)
            atomic_json(receipt_file, receipt, private=True)
            require_equal(tree_digest(BASE / name), receipt['targets'][name]['newFiles'], name + ' after switching')
        require_equal(snapshot()['protected'], baseline['protected'], 'Protected card/nginx/unit/relay')
        health()
        receipt['status'] = 'applied'
        receipt['finishedUTC'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        atomic_json(receipt_file, receipt, private=True)
    except Exception:
        restore(receipt, work, private, automatic=True)
        raise
    print(json.dumps({'status': receipt['status'], 'source': manifest['source'], 'release': args.release_id,
                      'staticRollback': str(rollback_root), 'privateReceipt': str(receipt_file),
                      'targets': {name: {'previouslyAbsent': item['previouslyAbsent'], 'files': len(item['newFiles']['files'])} for name, item in receipt['targets'].items()},
                      'database': 'preserved; private backup retained on server only'}, indent=2))


def restore(receipt, work, private, automatic=False):
    require_equal(snapshot()['protected'], receipt['baseline']['protected'], 'Protected card/nginx/unit/relay before restoring')
    if not automatic:
        require_equal(file_state(SERVER), receipt['serverNewState'], 'Server bundle/permissions before rollback')
        for name, item in receipt['targets'].items():
            require_equal(tree_digest(BASE / name), item['newFiles'], name + ' before rollback')
    failed = work / 'retained-candidate'
    failed.mkdir(exist_ok=True)
    for name, item in reversed(list(receipt['targets'].items())):
        if not item['switched']:
            continue
        current = tree_digest(BASE / name)
        if current == receipt['baseline']['targets'][name]:
            item['switched'] = False
            continue
        require_equal(current, item['newFiles'], name + ' before restoring')
        if item['previouslyAbsent']:
            os.replace(BASE / name, failed / name)
        else:
            backup = work / 'rollback' / name
            exchange(BASE / name, backup)
            os.replace(backup, failed / name)
        item['switched'] = False
    if receipt['serverInstalled']:
        current_server = file_state(SERVER)
        original_server = {key: value for key, value in receipt['baseline']['server'].items() if key != 'active'}
        if current_server != original_server:
            require_equal(current_server, receipt['serverNewState'], 'Server bundle/permissions before restoring')
            replace_server(private / 'server.mjs.previous')
        restart_and_check()
        receipt['serverInstalled'] = False
    require_equal(snapshot(), receipt['baseline'], 'Restored static/protected/server baseline')
    receipt['status'] = 'rolled-back-after-failure' if automatic else 'rolled-back'
    receipt['finishedUTC'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    atomic_json(private / 'receipt.json', receipt, private=True)


def rollback_release(args):
    work, private = release_paths(args.release_id)
    receipt = json.loads((private / 'receipt.json').read_text(encoding='utf-8'))
    recover = args.command == 'recover'
    if receipt['status'] != 'applied' and not (recover and receipt['status'] == 'preparing'):
        raise RuntimeError('Only an applied release can be rolled back once')
    restore(receipt, work, private, automatic=recover)
    print(json.dumps({'status': receipt['status'], 'release': args.release_id, 'database': 'preserved; not restored from backup'}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    commands.add_parser('inspect', help='Read-only fresh baseline; redirect stdout to a baseline JSON file')
    apply = commands.add_parser('apply', help='Install an exact frozen package after fresh baseline comparison')
    apply.add_argument('--archive', required=True)
    apply.add_argument('--baseline', required=True)
    apply.add_argument('--sha256', required=True, help='Archive SHA from the local release-preparation.json')
    apply.add_argument('--release-id', required=True)
    rollback = commands.add_parser('rollback', help='Restore assets/bundle, preserving live SQLite')
    rollback.add_argument('--release-id', required=True)
    recover = commands.add_parser('recover', help='Restore after interruption using persisted intent and old/new hashes; never restore SQLite')
    recover.add_argument('--release-id', required=True)
    args = parser.parse_args()
    if args.command == 'inspect':
        print(json.dumps(snapshot(), ensure_ascii=False, indent=2))
        return
    if os.geteuid() != 0:
        raise RuntimeError('Deployment requires the existing root deploy account')
    with pathlib.Path('/var/lock/three-dragon-release.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if args.command == 'apply':
            apply_release(args)
        else:
            rollback_release(args)


if __name__ == '__main__':
    main()
