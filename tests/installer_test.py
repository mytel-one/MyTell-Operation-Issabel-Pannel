"""Run with: python3 -m unittest discover -s tests -p 'installer_test.py' -v.

Integration cases use a temporary Issabel tree and a fake menu merger. The PHP
syntax, SQLite backups, filesystem replacement and rollback are real operations.
"""
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import tarfile
import tempfile
import unittest

REPO = Path(__file__).resolve().parents[1]
BASH = os.environ.get('TEST_BASH', shutil.which('bash') or 'bash')


class InstallerHelpTests(unittest.TestCase):
    def test_help_never_downloads_or_requires_a_token(self):
        with tempfile.TemporaryDirectory() as empty:
            result = subprocess.run([BASH, str(REPO / 'install.sh'), '--help'],
                                    input='', universal_newlines=True, cwd=empty, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('--lang', result.stdout)
        self.assertNotIn('GitHub Token:', result.stdout)


@unittest.skipUnless(shutil.which('php') and os.name != 'nt', 'Linux with PHP is required')
class InstallerIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='mytel-installer-test-')
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.package = self.base / 'release'
        self.package.mkdir()
        shutil.copy2(REPO / 'install.sh', self.package / 'install.sh')
        shutil.copy2(REPO / 'control.xml', self.package / 'control.xml')
        (self.package / 'VERSION').write_text('2.0.0\n')
        for lang in ('control_panel', 'control_panel_en'):
            source = self.package / lang
            (source / 'themes/default').mkdir(parents=True)
            (source / 'index.php').write_text('<?php echo "' + lang + '";\n')
            (source / 'themes/default/panel.tpl').write_text(lang)
            (source / 'libs').mkdir()
            (source / 'libs/config.php').write_text('<?php /* packaged defaults */\n')
        self.web = self.base / 'html'
        for name in ('modules', 'configs', 'libs'):
            (self.web / name).mkdir(parents=True)
        (self.web / 'configs/default.conf.php').write_text('<?php\n')
        for name in ('paloSantoDB.class.php', 'paloSantoACL.class.php'):
            (self.web / 'libs' / name).write_text('<?php\n')
        self.db = self.base / 'db'
        self.db.mkdir()
        for name in ('menu', 'acl'):
            with sqlite3.connect(str(self.db / (name + '.db'))) as db:
                db.execute('CREATE TABLE marker (value TEXT)')
                db.execute("INSERT INTO marker VALUES ('preserved')")
        with sqlite3.connect(str(self.db / 'menu.db')) as db:
            db.execute('CREATE TABLE menu(id TEXT, IdParent TEXT)')
            db.execute("INSERT INTO menu VALUES('pbxconfig','')")
        with sqlite3.connect(str(self.db / 'acl.db')) as db:
            db.execute('CREATE TABLE acl_resource(id INTEGER PRIMARY KEY,name TEXT)')
            db.execute('CREATE TABLE acl_group(id INTEGER PRIMARY KEY,name TEXT)')
            db.execute('CREATE TABLE acl_group_permission(id INTEGER PRIMARY KEY,id_action INTEGER,id_group INTEGER,id_resource INTEGER)')
            db.execute('CREATE TABLE acl_module_privileges(id INTEGER PRIMARY KEY,id_resource INTEGER,privilege TEXT)')
            db.execute('CREATE TABLE acl_module_group_permissions(id INTEGER PRIMARY KEY,id_module_privilege INTEGER,id_group INTEGER)')
            db.execute("INSERT INTO acl_group VALUES(1,'administrator')")
        with sqlite3.connect(str(self.db / 'control_panel_design.db')) as db:
            db.execute('CREATE TABLE area (id INTEGER PRIMARY KEY, name TEXT, height INTEGER, width INTEGER, description TEXT, no_column INTEGER, color TEXT)')
            db.execute("INSERT INTO area VALUES(1,'Extension',600,600,'Existing layout',1,'#123456')")
            db.execute('CREATE TABLE item_box (id INTEGER PRIMARY KEY,id_area INTEGER,id_device INTEGER)')
        bindir = self.base / 'bin'
        bindir.mkdir()
        merger = bindir / 'issabel-menumerge'
        merger.write_text('''#!/bin/bash
set -e
php -r '$d=new SQLite3(getenv("FIXTURE_DB")."/menu.db"); $d->exec("UPDATE marker SET value=\\\"merged\\\"");'
if [ "${FAIL_MENU:-0}" = 1 ]; then echo 'ERR: simulated ACL failure' >&2; exit 7; fi
if [ "${SILENT_MENU:-0}" = 1 ]; then exit 0; fi
php -r '$d=new SQLite3(getenv("FIXTURE_DB")."/menu.db"); $d->exec("INSERT INTO menu VALUES(\\\"control_panel\\\",\\\"pbxconfig\\\")"); $d=new SQLite3(getenv("FIXTURE_DB")."/acl.db"); $d->exec("INSERT INTO acl_resource VALUES(42,\\\"control_panel\\\")"); $d->exec("INSERT INTO acl_group_permission VALUES(42,1,1,42)");'
''')
        with merger.open('a') as script:
            script.write("""if [ "${SKIP_ACTION_PRIVILEGES:-0}" = 1 ]; then exit 0; fi
php -r '$db=new SQLite3(getenv("FIXTURE_DB")."/acl.db");$xml=simplexml_load_file($argv[1]);foreach($xml->menulist->menuitem->privilege as $permission){$q=$db->prepare("INSERT INTO acl_module_privileges(id_resource,privilege) VALUES(42,?)");$q->bindValue(1,(string)$permission["name"],SQLITE3_TEXT);$q->execute();$db->exec("INSERT INTO acl_module_group_permissions(id_group,id_module_privilege) VALUES(1,".$db->lastInsertRowID().")");}' "$1"
""")
        merger.chmod(0o755)
        self.env = dict(os.environ, PATH=str(bindir) + ':' + os.environ['PATH'],
                        FIXTURE_DB=str(self.db))

    def run_installer(self, *args, env=None):
        return subprocess.run([BASH, str(self.package / 'install.sh'),
                               '--root', str(self.web), '--db-dir', str(self.db),
                               '--backup-dir', str(self.base / 'backups'), *args],
                              input='', universal_newlines=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                              cwd=self.base, env=env or self.env)

    def test_script_relative_package_and_english_default(self):
        result = self.run_installer()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual((self.web / 'modules/control_panel/themes/default/panel.tpl').read_text(), 'control_panel_en')
        self.assertNotIn('Downloading', result.stdout)

    def test_english_flag_and_existing_layout_preserved(self):
        result = self.run_installer('--lang', 'en')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual((self.web / 'modules/control_panel/themes/default/panel.tpl').read_text(), 'control_panel_en')
        with sqlite3.connect(str(self.db / 'control_panel_design.db')) as db:
            self.assertEqual(db.execute('SELECT description,color FROM area WHERE id=1').fetchone(), ('Existing layout', '#123456'))
        backups = list((self.base / 'backups').glob('backup-*'))
        self.assertEqual(len(backups), 1)
        self.assertEqual(backups[0].stat().st_mode & 0o777, 0o700)
        self.assertTrue((backups[0] / 'control_panel_design.db').is_file())

    def test_merge_failure_restores_module_and_menu_database(self):
        old = self.web / 'modules/control_panel'
        old.mkdir()
        (old / 'original.txt').write_text('previous working module')
        result = self.run_installer('--lang', 'fa', env=dict(self.env, FAIL_MENU='1'))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('simulated ACL failure', result.stdout + result.stderr)
        self.assertEqual((old / 'original.txt').read_text(), 'previous working module')
        self.assertFalse((old / 'index.php').exists())
        with sqlite3.connect(str(self.db / 'menu.db')) as db:
            self.assertEqual(db.execute('SELECT value FROM marker').fetchone(), ('preserved',))
        self.assertNotIn('Installation complete', result.stdout)

    def test_missing_action_privileges_roll_back_installation(self):
        result = self.run_installer('--lang', 'en', env=dict(self.env, SKIP_ACTION_PRIVILEGES='1'))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('action privilege registration failed', result.stdout + result.stderr)
        self.assertFalse((self.web / 'modules/control_panel').exists())

    def test_existing_ami_configuration_is_preserved(self):
        old = self.web / 'modules/control_panel/libs'
        old.mkdir(parents=True)
        configuration = '<?php /* existing custom AMI configuration */\n'
        (old / 'config.php').write_text(configuration)
        result = self.run_installer('--lang', 'fa')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual((old / 'config.php').read_text(), configuration)
        backup = next((self.base / 'backups').glob('backup-*'))
        self.assertIn(str(self.web), (backup / 'README-restore.txt').read_text())

    def test_missing_layout_database_is_initialized_with_required_panels(self):
        (self.db / 'control_panel_design.db').unlink()
        result = self.run_installer('--lang', 'fa')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        with sqlite3.connect(str(self.db / 'control_panel_design.db')) as db:
            names = {row[0] for row in db.execute('SELECT name FROM area')}
            self.assertEqual(names, {'Extension', 'Queues', 'Conferences', 'Parkinglots', 'TrunksSIP', 'Trunks'} | {'Area' + str(n) for n in range(1, 10)})

    def test_legacy_layout_gains_color_without_losing_existing_rows(self):
        (self.db / 'control_panel_design.db').unlink()
        with sqlite3.connect(str(self.db / 'control_panel_design.db')) as db:
            db.execute('CREATE TABLE area (id INTEGER PRIMARY KEY,name TEXT,height INTEGER,width INTEGER,description TEXT,no_column INTEGER)')
            db.execute("INSERT INTO area VALUES(1,'Extension',600,600,'Legacy layout',1)")
        result = self.run_installer('--lang', 'fa')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        with sqlite3.connect(str(self.db / 'control_panel_design.db')) as db:
            self.assertEqual(db.execute("SELECT description FROM area WHERE id=1").fetchone(), ('Legacy layout',))
            self.assertTrue(db.execute("SELECT color FROM area WHERE id=1").fetchone()[0])

    def test_failed_first_install_restores_absent_module_and_layout_state(self):
        (self.db / 'control_panel_design.db').unlink()
        result = self.run_installer('--lang', 'fa', env=dict(self.env, FAIL_MENU='1'))
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((self.db / 'control_panel_design.db').exists())
        self.assertFalse((self.web / 'modules/control_panel').exists())

    def test_check_is_read_only(self):
        before = {p.relative_to(self.base): p.read_bytes() for p in self.base.rglob('*') if p.is_file()}
        result = self.run_installer('--check')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        after = {p.relative_to(self.base): p.read_bytes() for p in self.base.rglob('*') if p.is_file()}
        self.assertEqual(before, after)
        self.assertFalse((self.base / 'backups').exists())

    def test_backup_directory_cannot_be_the_filesystem_root(self):
        result = self.run_installer('--backup-dir', '/', '--check')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('backup directory', result.stdout + result.stderr)

    def test_existing_nonprivate_backup_directory_is_not_repermissioned(self):
        backup = self.base / 'backups'
        backup.mkdir(mode=0o755)
        backup.chmod(0o755)
        result = self.run_installer('--lang', 'fa')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(backup.stat().st_mode & 0o777, 0o755)
        self.assertFalse((self.web / 'modules/control_panel').exists())

    def test_syntax_failure_keeps_previous_module(self):
        old = self.web / 'modules/control_panel'
        old.mkdir()
        (old / 'original.txt').write_text('keep')
        (self.package / 'control_panel/index.php').write_text('<?php this is broken php;')
        result = self.run_installer('--lang', 'fa')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual((old / 'original.txt').read_text(), 'keep')

    def test_invalid_language_is_rejected_before_changes(self):
        result = self.run_installer('--lang', 'xx')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Unsupported language', result.stdout + result.stderr)
        self.assertFalse((self.web / 'modules/control_panel').exists())

    def test_success_exit_without_menu_registration_is_rejected(self):
        result = self.run_installer('--lang', 'fa', env=dict(self.env, SILENT_MENU='1'))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('permission verification failed', result.stdout + result.stderr)
        self.assertFalse((self.web / 'modules/control_panel').exists())
        with sqlite3.connect(str(self.db / 'menu.db')) as db:
            self.assertEqual(db.execute('SELECT value FROM marker').fetchone(), ('preserved',))

    def test_download_accepts_new_owner_archive_directory_without_token(self):
        archive = self.base / 'download.tar.gz'
        with tarfile.open(archive, 'w:gz') as tar:
            tar.add(str(self.package), arcname='AnyNewOwner-AnyRepository-abcd1234')
        standalone = self.base / 'standalone'
        standalone.mkdir()
        shutil.copy2(self.package / 'install.sh', standalone / 'install.sh')
        self.package = standalone
        curl = self.base / 'bin/curl'
        curl.write_text('''#!/bin/bash
while (( $# )); do
  if [[ "$1" = -o ]]; then cp -- "$FIXTURE_ARCHIVE" "$2"; exit 0; fi
  shift
done
exit 2
''')
        curl.chmod(0o755)
        result = self.run_installer('--lang', 'en', '--ref', 'v2.0.0', env=dict(self.env, FIXTURE_ARCHIVE=str(archive)))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn('Downloading mytel-one/MyTell-Operation-Issabel-Pannel', result.stdout)
        self.assertIn('(v2.0.0)', result.stdout)
        self.assertEqual((self.web / 'modules/control_panel/themes/default/panel.tpl').read_text(), 'control_panel_en')


if __name__ == '__main__':
    unittest.main()
