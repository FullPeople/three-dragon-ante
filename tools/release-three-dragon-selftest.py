"""Exercise package guards and recovery against isolated synthetic file trees.

No remote host or real SQLite data is accessed. Native renameat2 atomicity and
Unix ownership semantics are reviewed separately; portable fixtures substitute
the exchange and chown operations so Windows can test transaction boundaries.
"""
import contextlib
import ctypes
import hashlib
import importlib.util
import io
import json
import os
import pathlib
import shutil
import sqlite3
import subprocess
import sys
import tarfile
import tempfile
import types
import uuid
import zipfile
from unittest import mock

SOURCE = pathlib.Path(__file__).with_name('deploy-three-dragon-release.py')
RESULT = []


def load():
    spec = importlib.util.spec_from_file_location('tda_release', SOURCE)
    module = importlib.util.module_from_spec(spec)
    fallback = types.SimpleNamespace(flock=lambda *_: None, LOCK_EX=2, LOCK_NB=4)
    with mock.patch.dict(sys.modules, {'fcntl': fallback}), mock.patch.object(ctypes, 'CDLL', return_value=types.SimpleNamespace()):
        spec.loader.exec_module(module)
    return module


def make_archive(module, destination, defect=None, target_names=None, scope=None, host_overlay=None):
    contents = {}
    targets = []
    for name in module.TARGETS if target_names is None else target_names:
        path = 'workbench-panels/table.html' if name == 'suite-dev' else 'three-dragon-ante.html' if name == 'suite' else 'index.html'
        if defect == 'suite-outside' and name == 'suite':
            path = 'manifest.json'
        if defect in ('declared-host', 'host-undeclared', 'host-path', 'host-sha', 'host-missing') and name == 'suite':
            path = 'background.html' if defect == 'host-path' else 'settings.html'
        data = ('new ' + name).encode()
        contents[name + '/' + path] = data
        targets.append({'name': name, 'kind': 'suite-overlay' if name.startswith('suite') else 'independent',
                        'files': [{'path': path, 'sha256': hashlib.sha256(data).hexdigest(), 'size': len(data)}]})
    server = b'synthetic new service'
    source = b'synthetic source archive; never deployed as code'
    contents['server/server.mjs'] = server
    contents['three-dragon-source-' + 'a' * 12 + '.zip'] = source
    manifest = {'format': 1, 'repository': 'FullPeople/three-dragon-ante', 'source': 'a' * 40,
                'version': '0.8.0', 'api': '/three-dragon-api/v1', 'targets': targets,
                'server': {'path': 'server/server.mjs', 'sha256': hashlib.sha256(server).hexdigest(), 'size': len(server)},
                'sourceArchive': {'path': 'three-dragon-source-' + 'a' * 12 + '.zip', 'sha256': hashlib.sha256(source).hexdigest()}}
    if scope is not None:
        manifest['scope'] = scope
    if host_overlay is not None:
        manifest['hostOverlay'] = host_overlay
    if defect == 'sha':
        manifest['server']['sha256'] = 'b' * 64
    if defect in ('declared-host', 'host-path', 'host-sha', 'host-missing'):
        path = 'suite/background.html' if defect == 'host-path' else 'suite/settings.html'
        record = {'path': path, 'sha256': hashlib.sha256(contents[path]).hexdigest(), 'beforeSha256': None}
        if defect == 'host-sha':
            record['sha256'] = 'b' * 64
        outputs = [record]
        if defect == 'host-missing':
            outputs.append({'path': 'suite/assets/missing-a.js', 'sha256': 'b' * 64, 'beforeSha256': None})
        manifest['hostOverlay'] = {'mode': 'website-link-only', 'website': 'https://obr.dnd.center/three-dragon-ante/', 'outputs': outputs}
    contents['release-manifest.json'] = json.dumps(manifest).encode()
    if defect == 'extra':
        contents['unlisted.txt'] = b'not allowed'
    if defect == 'traversal':
        contents['../outside.txt'] = b'not allowed'
    with tarfile.open(destination, 'w:gz') as archive:
        for name, data in contents.items():
            info = tarfile.TarInfo(name)
            info.size = len(data)
            archive.addfile(info, io.BytesIO(data))
        if defect == 'symlink':
            info = tarfile.TarInfo('a-link')
            info.type = tarfile.SYMTYPE
            info.linkname = '/etc/passwd'
            archive.addfile(info)
        if defect == 'duplicate':
            info = tarfile.TarInfo('release-manifest.json')
            data = contents['release-manifest.json']
            info.size = len(data)
            archive.addfile(info, io.BytesIO(data))


def fixture(directory, defect=None, website_only=False):
    module = load()
    module.BASE = directory / 'sites'
    module.SERVER = directory / 'server' / 'server.mjs'
    module.DATABASE = directory / 'private-game.sqlite'
    module.PRIVATE = directory / 'private-backups'
    module.UPLOAD = directory / 'uploads'
    module.BASE.mkdir()
    module.SERVER.parent.mkdir()
    module.SERVER.write_text('synthetic old service')
    module.UPLOAD.mkdir()
    card = module.BASE / 'card'
    card.mkdir()
    (card / 'index.html').write_text('protected card')
    for name in module.TARGETS:
        if name == 'three-dragon-ante':
            continue  # exercise a new stable target
        target = module.BASE / name
        target.mkdir()
        (target / 'old-hashed-asset.js').write_text('must remain readable')
        (target / 'manifest.json').write_text('protected original manifest')
    config = directory / 'protected.conf'
    config.write_text('synthetic nginx/unit/relay configuration')
    module.PROTECTED_FILES = (str(config),)
    module.PROTECTED_SERVICES = ('synthetic-protected-service',)
    module.command = lambda *args: 'v22.17.1' if args[0] == '/usr/local/bin/node' else 'active'
    module.health = lambda: None
    module.restart_and_check = lambda: None
    def exchange(a, b):
        temporary = a.with_name(a.name + '-mock-exchange-' + uuid.uuid4().hex)
        os.replace(a, temporary)
        os.replace(b, a)
        os.replace(temporary, b)
    module.exchange = exchange
    with sqlite3.connect(module.DATABASE) as database:
        database.execute('CREATE TABLE synthetic (value TEXT)')
        database.execute("INSERT INTO synthetic VALUES ('synthetic private fixture')")
    baseline = module.snapshot()
    baseline_file = module.UPLOAD / 'baseline.json'
    baseline_file.write_text(json.dumps(baseline))
    archive = module.UPLOAD / 'release.tar.gz'
    make_archive(module, archive, defect, target_names=module.WEBSITE_TARGETS if website_only else None, scope='website-only' if website_only else None)
    args = types.SimpleNamespace(command='apply', archive=str(archive), baseline=str(baseline_file), sha256=module.digest(archive), release_id='synthetic-test')
    return module, baseline, args


def expect_error(callback):
    try:
        callback()
    except (ValueError, RuntimeError, OSError):
        return
    raise AssertionError('Expected operation to be rejected')


def record(name, callback):
    callback()
    RESULT.append({'name': name, 'ok': True})


def transaction(directory, point=None, interrupted=False, host=False, website_only=False):
    module, baseline, args = fixture(directory, 'declared-host' if host else None, website_only)
    original_exchange = module.exchange
    count = 0
    def injected(a, b):
        nonlocal count
        count += 1
        if count == 1 and point == 'before-exchange':
            raise RuntimeError('synthetic failure before exchange')
        original_exchange(a, b)
        if count == 1 and point == 'after-exchange':
            if interrupted:
                raise KeyboardInterrupt('synthetic process interruption')
            raise RuntimeError('synthetic failure after exchange')
    module.exchange = injected
    original_replace = module.replace_server
    writes = 0
    def injected_replace(source):
        nonlocal writes
        writes += 1
        original_replace(source)
        if writes == 1 and point == 'after-server':
            raise RuntimeError('synthetic failure after server replace')
    module.replace_server = injected_replace
    if point == 'startup-failure':
        current_state = 'active'
        restarts = 0
        original_command = module.command
        def state_command(*args):
            if 'obr-three-dragon' in args:
                # Faithfully reproduce systemctl is-active's nonzero failure.
                if 'is-active' in args and current_state == 'failed':
                    raise module.subprocess.CalledProcessError(3, args)
                return current_state
            return original_command(*args)
        module.command = state_command
        def start_candidate():
            nonlocal current_state, restarts
            restarts += 1
            if restarts == 1:
                current_state = 'failed'
                raise RuntimeError('synthetic new bundle failed to start')
            current_state = 'active'
        module.restart_and_check = start_candidate
    # Portable fixture only: real deployment retains original Unix owner/group.
    with mock.patch.object(os, 'chown', create=True, new=lambda *_: None), mock.patch.object(module.subprocess, 'run', return_value=types.SimpleNamespace(returncode=0)), contextlib.redirect_stdout(io.StringIO()):
        if interrupted:
            try:
                module.apply_release(args)
            except KeyboardInterrupt:
                pass
            else:
                raise AssertionError('Interruption was not exercised')
            args.command = 'recover'
            module.rollback_release(args)
        elif point:
            expect_error(lambda: module.apply_release(args))
        else:
            module.apply_release(args)
            for name in ('suite', 'suite-dev'):
                assert (module.BASE / name / 'manifest.json').read_text() == 'protected original manifest'
                assert (module.BASE / name / 'old-hashed-asset.js').read_text() == 'must remain readable'
            assert (module.BASE / 'three-dragon-ante').is_dir()
            if website_only:
                after = module.snapshot()
                assert set(after['targets']) == set(module.TARGETS)
                assert all(after['targets'][name] == baseline['targets'][name] for name in ('suite', 'suite-dev'))
                work, private = module.release_paths(args.release_id)
                receipt = json.loads((private / 'receipt.json').read_text())
                assert receipt['scope'] == 'website-only' and set(receipt['targets']) == set(module.WEBSITE_TARGETS)
                assert set(receipt['releaseTargets']) == set(module.WEBSITE_TARGETS)
                assert set(item.name for item in (work / 'rollback').iterdir()) == {'three-dragon-ante-dev'}
                assert not (work / 'stage' / 'suite').exists() and not (work / 'stage' / 'suite-dev').exists()
                with sqlite3.connect(module.DATABASE) as database:
                    database.execute("UPDATE synthetic SET value = 'synthetic live update after deployment'")
            args.command = 'rollback'
            module.rollback_release(args)
        assert module.snapshot() == baseline
        with sqlite3.connect(module.DATABASE) as database:
            expected = 'synthetic live update after deployment' if website_only and not point and not interrupted else 'synthetic private fixture'
            assert database.execute('SELECT value FROM synthetic').fetchone()[0] == expected
        assert (module.PRIVATE / args.release_id / 'game.sqlite.private-backup').is_file()
        assert not (module.BASE / '.three-dragon-releases' / args.release_id / 'payload' / 'game.sqlite').exists()


def package_cli_fixture(directory, website_only):
    """Run the real packager with synthetic compiler outputs, never production builds.

    This checks CLI scope, same-origin build inputs, exact tar/source manifests
    and absence of any Suite payload when the overlay is intentionally absent.
    """
    repository = directory / 'source'
    tools = repository / 'tools'
    tools.mkdir(parents=True)
    (repository / 'package.json').write_text(json.dumps({'type': 'module', 'version': '0.9.1-dev'}))
    (repository / '.gitignore').write_text('node_modules/\n.local-evidence/\n.env.local\n')
    (repository / 'SOURCE.txt').write_text('synthetic tracked source must be included in full GPL archive')
    shutil.copy2(SOURCE.parent / 'release-three-dragon.mjs', tools / 'release-three-dragon.mjs')
    shutil.copy2(SOURCE, tools / SOURCE.name)
    shutil.copy2(SOURCE.parent.parent / 'LICENSE', repository / 'LICENSE')
    compiler = repository / 'node_modules' / 'typescript' / 'bin'
    compiler.mkdir(parents=True)
    (compiler / 'tsc').write_text("import {appendFileSync} from 'node:fs';appendFileSync('.local-evidence/build-calls.txt','typecheck\\n');")
    vite = repository / 'node_modules' / 'vite' / 'bin'
    vite.mkdir(parents=True)
    (vite / 'vite.js').write_text("""import {appendFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
const out=process.argv[process.argv.indexOf('--outDir')+1],channel=process.env.THREE_DRAGON_CHANNEL,api=process.env.VITE_TDA_API;
if(!['dev','stable'].includes(channel)||api!=='/three-dragon-api/v1')throw Error('Unexpected build target/API');
appendFileSync('.local-evidence/build-calls.txt',channel+' '+api+'\\n');mkdirSync(out,{recursive:true});
const name=channel==='dev'?'three-dragon-ante-dev':'three-dragon-ante';
for(const path of ['index.html','table.html','background.html','launcher.html'])writeFileSync(join(out,path),'synthetic '+channel+' '+api);
writeFileSync(join(out,'manifest.json'),JSON.stringify({version:'0.9.1'+(channel==='dev'?'-dev':''),background_url:'/'+name+'/background.html'}));
""")
    (tools / 'build-three-dragon-server.mjs').write_text("""import {appendFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';appendFileSync('.local-evidence/build-calls.txt','server\\n');
mkdirSync(process.env.TDA_SERVER_OUT,{recursive:true});writeFileSync(join(process.env.TDA_SERVER_OUT,'server.mjs'),'export const synthetic = true;');
""")
    evidence = repository / '.local-evidence'
    evidence.mkdir()
    (repository / '.env.local').write_text('DO_NOT_PACKAGE=synthetic fixture only')
    subprocess.run(['git', 'init', '-q'], cwd=repository, check=True, capture_output=True)
    subprocess.run(['git', 'add', '.gitignore', 'LICENSE', 'SOURCE.txt', 'package.json', 'tools'], cwd=repository, check=True, capture_output=True)
    subprocess.run(['git', '-c', 'user.name=Synthetic Release Test', '-c', 'user.email=synthetic@example.invalid', '-c', 'core.hooksPath=.local-evidence/no-hooks', 'commit', '-qm', 'synthetic fixture'], cwd=repository, check=True, capture_output=True)
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=repository, text=True).strip()
    out = directory / 'artifacts'
    command = ['node', str(tools / 'release-three-dragon.mjs'), '--out', str(out)]
    if website_only:
        for invalid in (['--website-only', '--overlay', str(directory / 'missing-overlay')], ['--website-only', '--website-only'], ['--website-only', '--target', 'suite']):
            result = subprocess.run(command + invalid, cwd=repository, capture_output=True, text=True)
            assert result.returncode != 0 and not out.exists()
        command += ['--website-only']
    else:
        overlay = directory / 'overlay'
        overlay.mkdir()
        outputs = []
        for name, path in (('suite-dev', 'workbench-panels/table.html'), ('suite', 'three-dragon-ante.html')):
            file = overlay / name / path
            file.parent.mkdir(parents=True)
            file.write_text('synthetic frozen overlay ' + name)
            outputs.append({'path': name + '/' + path, 'sha256': hashlib.sha256(file.read_bytes()).hexdigest()})
        (overlay / 'overlay-manifest.json').write_text(json.dumps({'tdaSource': head, 'api': '/three-dragon-api/v1', 'suiteSource': 'b' * 40, 'targets': ['suite', 'suite-dev'], 'outputs': outputs}))
        command += ['--overlay', str(overlay)]
    subprocess.run(command, cwd=repository, check=True, capture_output=True, text=True)
    receipt = json.loads((out / 'release-preparation.json').read_text())
    expected = set(load().WEBSITE_TARGETS if website_only else load().TARGETS)
    assert {target['name'] for target in receipt['targets']} == expected
    assert receipt['scope'] == ('website-only' if website_only else 'all-four')
    assert (evidence / 'build-calls.txt').read_text().splitlines() == ['typecheck', 'dev /three-dragon-api/v1', 'stable /three-dragon-api/v1', 'server']
    with tarfile.open(receipt['archive']['path'], 'r:gz') as archive:
        names = archive.getnames()
        manifest = json.load(archive.extractfile('release-manifest.json'))
        assert {target['name'] for target in manifest['targets']} == expected
        if website_only:
            assert manifest['hostOverlay'] is None and not any(name.startswith(('suite/', 'suite-dev/')) for name in names)
        source = archive.extractfile(manifest['sourceArchive']['path']).read()
        assert hashlib.sha256(source).hexdigest() == manifest['sourceArchive']['sha256']
        with zipfile.ZipFile(io.BytesIO(source)) as package:
            tracked = subprocess.check_output(['git', 'ls-files', '-z'], cwd=repository).decode().split('\0')
            assert {name for name in package.namelist() if not name.endswith('/')} == {'three-dragon-ante/' + name for name in tracked if name}
            assert package.read('three-dragon-ante/LICENSE') == (repository / 'LICENSE').read_bytes()
            assert not any('.env.local' in name or '.local-evidence' in name for name in package.namelist())
    deployed = load()
    parsed = deployed.package_manifest(out / 'three-dragon-release.tar.gz', directory / 'validated-payload')
    assert set(deployed.manifest_targets(parsed)) == expected


def main():
    # Deliberately retain fixture evidence under U (or explicit override).
    parent = pathlib.Path(os.environ.get('TDA_RELEASE_TEST_OUT', 'U:/CodexWork/2026-10-04/three-dragon-release-selftest'))
    parent.mkdir(parents=True, exist_ok=True)
    evidence = pathlib.Path(tempfile.mkdtemp(prefix='run-', dir=parent))
    module = load()
    def guard_paths():
        for value in ('../a', '/absolute', 'a/../b', 'a\\b', '.env.local', 'a/game.sqlite', '.git/config', 'a//b'):
            expect_error(lambda value=value: module.safe_relative(value))
    record('unsafe/private paths rejected', guard_paths)
    for defect in ('traversal', 'symlink', 'duplicate', 'extra', 'sha', 'suite-outside', 'host-undeclared', 'host-path', 'host-sha', 'host-missing'):
        def test(defect=defect):
            archive = evidence / (defect + '.tar.gz')
            make_archive(module, archive, defect)
            expect_error(lambda: module.package_manifest(archive, evidence / (defect + '-extracted')))
        record('package rejects ' + defect, test)
    def declared_host():
        archive = evidence / 'declared-host.tar.gz'
        make_archive(module, archive, 'declared-host')
        manifest = module.package_manifest(archive, evidence / 'declared-host-extracted')
        assert manifest['hostOverlay']['outputs'][0]['path'] == 'suite/settings.html'
    record('only an explicitly declared website-link host entry is accepted', declared_host)
    def host_baseline_guard():
        baseline = {'targets': {'suite': {'files': {'settings.html': {'sha256': 'a' * 64}, 'assets/reused-a.js': {'sha256': 'b' * 64}}}}}
        manifest = {'hostOverlay': {'outputs': [{'path': 'suite/settings.html', 'sha256': 'c' * 64, 'beforeSha256': 'a' * 64}, {'path': 'suite/assets/new-a.js', 'sha256': 'd' * 64, 'beforeSha256': None}], 'unchanged': [{'path': 'suite/assets/reused-a.js', 'sha256': 'b' * 64}]}}
        module.validate_host_baseline(manifest, baseline)
        baseline['targets']['suite']['files']['settings.html']['sha256'] = 'e' * 64
        expect_error(lambda: module.validate_host_baseline(manifest, baseline))
        baseline['targets']['suite']['files']['settings.html']['sha256'] = 'a' * 64
        baseline['targets']['suite']['files']['assets/reused-a.js']['sha256'] = 'e' * 64
        expect_error(lambda: module.validate_host_baseline(manifest, baseline))
        baseline['targets']['suite']['files']['assets/reused-a.js']['sha256'] = 'b' * 64
        baseline['targets']['suite']['files']['assets/new-a.js'] = {'sha256': 'e' * 64}
        expect_error(lambda: module.validate_host_baseline(manifest, baseline))
    record('host baseline rejects changed entries, changed reused dependencies and conflicting new assets', host_baseline_guard)
    host_directory = evidence / 'host-transaction'
    host_directory.mkdir()
    record('declared website-link host apply and rollback preserve the original targets', lambda: transaction(host_directory, host=True))
    for name, point, interrupted in (
        ('apply and rollback preserve all targets and private database', None, False),
        ('failure before directory exchange restores baseline', 'before-exchange', False),
        ('failure after directory exchange restores baseline', 'after-exchange', False),
        ('failure after bundle replace restores baseline', 'after-server', False),
        ('failed service remains inspectable and old bundle restarts', 'startup-failure', False),
        ('interruption recovery follows persisted switch intent', 'after-exchange', True),
    ):
        directory = evidence / ('transaction-' + str(len(RESULT)))
        directory.mkdir()
        record(name, lambda directory=directory, point=point, interrupted=interrupted: transaction(directory, point, interrupted))
    def drift_guard():
        directory = evidence / 'drift'
        directory.mkdir()
        deployed, baseline, args = fixture(directory)
        (deployed.BASE / 'card' / 'index.html').write_text('synthetic changed card')
        expect_error(lambda: deployed.apply_release(args))
        assert deployed.digest(deployed.SERVER) == baseline['server']['sha256']
        assert not deployed.PRIVATE.exists()
    record('fresh baseline rejects unrelated deployment drift before mutation', drift_guard)
    def archive_guard():
        directory = evidence / 'archive-sha'
        directory.mkdir()
        deployed, baseline, args = fixture(directory)
        args.sha256 = 'b' * 64
        expect_error(lambda: deployed.apply_release(args))
        assert deployed.snapshot() == baseline and not deployed.PRIVATE.exists()
    record('outer archive SHA rejects replacement before mutation', archive_guard)
    def space_guard():
        directory = evidence / 'insufficient-space'
        directory.mkdir()
        deployed, baseline, args = fixture(directory)
        with mock.patch.object(shutil, 'disk_usage', return_value=types.SimpleNamespace(free=1)):
            expect_error(lambda: deployed.apply_release(args))
        assert deployed.snapshot() == baseline and not deployed.PRIVATE.exists()
    record('insufficient disk space rejected before staging or database backup', space_guard)
    def control_guard():
        directory = evidence / 'invalid-control-parent'
        directory.mkdir()
        deployed, baseline, args = fixture(directory)
        file = directory / 'parent-is-file'
        file.write_text('unrelated existing file')
        deployed.PRIVATE = file / 'nested'
        expect_error(lambda: deployed.apply_release(args))
        assert deployed.digest(deployed.SERVER) == baseline['server']['sha256']
        assert file.read_text() == 'unrelated existing file'
    record('control paths reject non-directory parents before mutation', control_guard)
    def selection_guards():
        for index, (scope, targets, host) in enumerate((
            ('website-only', ('suite',), None),
            ('website-only', ('three-dragon-ante-dev',), None),
            ('website-only', ('three-dragon-ante-dev', 'suite-dev'), None),
            ('website-only', ('three-dragon-ante-dev', 'three-dragon-ante-dev'), None),
            ('website-only', module.TARGETS, None),
            (None, module.WEBSITE_TARGETS, None),
            ('arbitrary-subset', module.WEBSITE_TARGETS, None),
            ('website-only', module.WEBSITE_TARGETS, {}),
        )):
            archive = evidence / ('selection-' + str(index) + '.tar.gz')
            make_archive(module, archive, target_names=targets, scope=scope, host_overlay=host)
            expect_error(lambda archive=archive, index=index: module.package_manifest(archive, evidence / ('selection-' + str(index) + '-extracted')))
    record('only explicit website pairs or all four targets are accepted; Suite subsets and website host overlays rejected', selection_guards)
    for name, website_only in (('real packager website-only needs no overlay and retains exact API/full GPL source', True), ('real packager default remains compatible with all four targets', False)):
        directory = evidence / ('packager-website' if website_only else 'packager-default')
        directory.mkdir()
        record(name, lambda directory=directory, website_only=website_only: package_cli_fixture(directory, website_only))
    for name, point, interrupted in (
        ('website-only apply and rollback preserve Suite bytes/attributes and post-deploy live database writes', None, False),
        ('website-only switch failure restores both website targets without modifying Suite', 'after-exchange', False),
        ('website-only interruption recovers using the exact two-target persisted intent', 'after-exchange', True),
    ):
        directory = evidence / ('website-transaction-' + str(len(RESULT)))
        directory.mkdir()
        record(name, lambda directory=directory, point=point, interrupted=interrupted: transaction(directory, point, interrupted, website_only=True))
    def website_drift(before_apply=False, interrupted=False):
        for index, mutation in enumerate(('content', 'mode')):
            directory = evidence / ('website-drift-' + str(len(RESULT)) + '-' + str(index))
            directory.mkdir()
            deployed, baseline, args = fixture(directory, website_only=True)
            if not before_apply:
                if interrupted:
                    original_exchange = deployed.exchange
                    def interrupted_exchange(a, b):
                        original_exchange(a, b)
                        raise KeyboardInterrupt('synthetic website process interruption')
                    deployed.exchange = interrupted_exchange
                with mock.patch.object(os, 'chown', create=True, new=lambda *_: None), mock.patch.object(deployed.subprocess, 'run', return_value=types.SimpleNamespace(returncode=0)), contextlib.redirect_stdout(io.StringIO()):
                    try:
                        deployed.apply_release(args)
                    except KeyboardInterrupt:
                        assert interrupted
                    else:
                        assert not interrupted
            file = deployed.BASE / 'suite-dev' / 'old-hashed-asset.js'
            if mutation == 'content':
                file.write_text('synthetic unrelated Suite deployment')
            else:
                os.chmod(file, 0o444)
            before_rejection = deployed.snapshot()
            assert before_rejection['targets']['suite-dev'] != baseline['targets']['suite-dev']
            if before_apply:
                expect_error(lambda: deployed.apply_release(args))
                assert not deployed.PRIVATE.exists()
            else:
                args.command = 'recover' if interrupted else 'rollback'
                with mock.patch.object(os, 'chown', create=True, new=lambda *_: None), mock.patch.object(deployed.subprocess, 'run', return_value=types.SimpleNamespace(returncode=0)), contextlib.redirect_stdout(io.StringIO()):
                    expect_error(lambda: deployed.rollback_release(args))
                receipt = json.loads((deployed.PRIVATE / args.release_id / 'receipt.json').read_text())
                assert receipt['status'] == ('preparing' if interrupted else 'applied')
            assert deployed.snapshot() == before_rejection
    record('website-only fresh full baseline rejects Suite content and attribute drift before staging', lambda: website_drift(before_apply=True))
    record('website-only rollback rejects unselected Suite content and attribute drift before touching code/assets', website_drift)
    record('website-only interruption recovery rejects Suite drift before touching code/assets', lambda: website_drift(interrupted=True))
    def switch_drift_guard():
        directory = evidence / 'website-switch-drift'
        directory.mkdir()
        deployed, baseline, args = fixture(directory, website_only=True)
        original_exchange = deployed.exchange
        def drift_after_exchange(a, b):
            original_exchange(a, b)
            (deployed.BASE / 'suite' / 'old-hashed-asset.js').write_text('synthetic concurrent unrelated Suite write')
        deployed.exchange = drift_after_exchange
        with mock.patch.object(os, 'chown', create=True, new=lambda *_: None), mock.patch.object(deployed.subprocess, 'run', return_value=types.SimpleNamespace(returncode=0)), contextlib.redirect_stdout(io.StringIO()):
            expect_error(lambda: deployed.apply_release(args))
        assert not (deployed.BASE / 'three-dragon-ante').exists()
        assert (deployed.BASE / 'suite' / 'old-hashed-asset.js').read_text() == 'synthetic concurrent unrelated Suite write'
        receipt = json.loads((deployed.PRIVATE / args.release_id / 'receipt.json').read_text())
        assert receipt['status'] == 'preparing' and receipt['targets']['three-dragon-ante-dev']['switched']
    record('website-only post-switch guard detects concurrent Suite drift and retains recoverable receipt', switch_drift_guard)
    def legacy_receipt():
        directory = evidence / 'legacy-four-receipt'
        directory.mkdir()
        deployed, baseline, args = fixture(directory)
        with mock.patch.object(os, 'chown', create=True, new=lambda *_: None), mock.patch.object(deployed.subprocess, 'run', return_value=types.SimpleNamespace(returncode=0)), contextlib.redirect_stdout(io.StringIO()):
            deployed.apply_release(args)
            path = deployed.PRIVATE / args.release_id / 'receipt.json'
            receipt = json.loads(path.read_text())
            del receipt['scope'], receipt['releaseTargets']
            path.write_text(json.dumps(receipt))
            args.command = 'rollback'
            deployed.rollback_release(args)
        assert deployed.snapshot() == baseline
    record('pre-scope four-target receipts remain valid for rollback', legacy_receipt)
    output = {'pass': len(RESULT), 'fail': 0, 'tests': RESULT, 'evidence': str(evidence),
              'scope': 'Synthetic local filesystem/SQLite; exchange and owner operations are mocked; no remote deployment or actual player data.'}
    (evidence / 'result.json').write_text(json.dumps(output, indent=2) + '\n')
    print(json.dumps(output, indent=2))


if __name__ == '__main__':
    main()
