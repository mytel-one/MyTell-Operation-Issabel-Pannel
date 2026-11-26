#!/usr/bin/env bash
# MyTel Operation for Issabel 5. GPL-2.0; upstream credits are in README.md.
set -Eeuo pipefail
umask 077

REPO="${MYTEL_REPO:-mytel-one/MyTell-Operation-Issabel-Pannel}"
REF="${MYTEL_REF:-main}"
WEB_ROOT="${ISSABEL_ROOT:-/var/www/html}"
DB_ROOT=""
BACKUP_ROOT="/root/mytel-operation-backups"
LANGUAGE=""
CHECK_ONLY=0
WORK=""
STAGE=""
PREVIOUS=""
BACKUP=""
SWAPPED=0
DATABASES_CHANGED=0
DESIGN_EXISTED=0

usage() {
    cat <<'USAGE'
MyTel Operation — Issabel 5
Usage: bash install.sh [--lang fa|en] [--ref TAG_OR_COMMIT] [--check]
  --lang fa|en       Panel language (English by default; prompts on a terminal)
  --ref REF          Public release tag, branch or commit (default: main)
  --check            Verify prerequisites without downloading or changing files
  --root PATH        Issabel document root (default: /var/www/html)
  --db-dir PATH      Issabel SQLite directory (default: ../db beside document root)
  --backup-dir PATH  Private backup location (default: /root/mytel-operation-backups)
  --help             Show this help

A public GitHub download requires no token. A complete local checkout is used
relative to this script, regardless of the current working directory.
MYTEL_REF selects a release tag or commit; MYTEL_REPO overrides the repository.
USAGE
}

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
log() { printf '%s\n' "$*"; }

database_copy() {
    php -r '
        $source = new SQLite3($argv[1], SQLITE3_OPEN_READONLY);
        $source->busyTimeout(10000);
        $destination = new SQLite3($argv[2]);
        $destination->busyTimeout(10000);
        if (!$source->backup($destination)) { fwrite(STDERR, "SQLite backup/restore failed\n"); exit(1); }
        $destination->close(); $source->close();
    ' "$1" "$2"
}

cleanup() {
    local status=$?
    trap - EXIT ERR INT TERM
    set +e
    if (( status != 0 )); then
        if (( SWAPPED )); then
            rm -rf -- "$DEST"
            if [[ -n "$PREVIOUS" && -d "$PREVIOUS" ]]; then mv -- "$PREVIOUS" "$DEST"; fi
        fi
        if (( DATABASES_CHANGED )) && [[ -n "$BACKUP" ]]; then
            local name
            for name in menu acl; do
                if ! database_copy "$BACKUP/$name.db" "$DB_ROOT/$name.db"; then
                    log "RECOVERY REQUIRED: restore $BACKUP/$name.db to $DB_ROOT/$name.db" >&2
                fi
            done
            if (( DESIGN_EXISTED )); then
                database_copy "$BACKUP/control_panel_design.db" "$DB_ROOT/control_panel_design.db" || \
                    log "RECOVERY REQUIRED: restore the panel design database from $BACKUP" >&2
            else
                rm -f -- "$DB_ROOT/control_panel_design.db"
            fi
        fi
        log 'Installation failed. Previous panel and database backups were retained.' >&2
    fi
    [[ -z "$STAGE" || ! -d "$STAGE" ]] || rm -rf -- "$STAGE"
    [[ -z "$WORK" || ! -d "$WORK" ]] || rm -rf -- "$WORK"
    exit "$status"
}

while (( $# )); do
    case "$1" in
        --help|-h) usage; exit 0 ;;
        --check) CHECK_ONLY=1; shift ;;
        --lang|--ref|--root|--db-dir|--backup-dir)
            (( $# >= 2 )) || fail "Missing value for $1"
            case "$1" in
                --lang) LANGUAGE="$2" ;;
                --ref) REF="$2" ;;
                --root) WEB_ROOT="$2" ;;
                --db-dir) DB_ROOT="$2" ;;
                --backup-dir) BACKUP_ROOT="$2" ;;
            esac
            shift 2 ;;
        *) fail "Unknown option: $1 (use --help)" ;;
    esac
done
[[ -z "$LANGUAGE" || "$LANGUAGE" = fa || "$LANGUAGE" = en ]] || fail "Unsupported language: $LANGUAGE (use fa or en)"
[[ "$REF" =~ ^[A-Za-z0-9_./-]+$ && "$REF" != *..* ]] || fail 'Invalid repository ref.'

[[ "$(id -u)" = 0 ]] || fail 'Run this installer as root.'
for tool in php tar cp mv find mktemp chown chmod install readlink stat flock issabel-menumerge; do
    command -v "$tool" >/dev/null 2>&1 || fail "Required command is missing: $tool"
done
[[ "$WEB_ROOT" = /* && -d "$WEB_ROOT/modules" && -f "$WEB_ROOT/configs/default.conf.php" ]] || fail 'Issabel document root was not found.'
WEB_ROOT="$(readlink -f -- "$WEB_ROOT")"
[[ "$WEB_ROOT" != / ]] || fail 'The filesystem root cannot be an Issabel document root.'
[[ -n "$DB_ROOT" ]] || DB_ROOT="$(dirname "$WEB_ROOT")/db"
[[ "$DB_ROOT" = /* && -d "$DB_ROOT" ]] || fail 'Issabel database directory was not found.'
DB_ROOT="$(readlink -f -- "$DB_ROOT")"
[[ "$DB_ROOT" != / ]] || fail 'The database directory cannot be the filesystem root.'
[[ "$BACKUP_ROOT" = /* ]] || fail 'The backup directory must be an absolute path.'
BACKUP_ROOT="$(readlink -m -- "$BACKUP_ROOT")"
[[ "$BACKUP_ROOT" != / ]] || fail 'The backup directory cannot be the filesystem root.'
[[ "$BACKUP_ROOT" != "$WEB_ROOT" && "$BACKUP_ROOT" != "$WEB_ROOT/"* ]] || fail 'Backups must be stored outside the web document root.'
if [[ -e "$BACKUP_ROOT" ]]; then
    [[ -d "$BACKUP_ROOT" && "$(stat -c %u "$BACKUP_ROOT")" = 0 && "$(stat -c %a "$BACKUP_ROOT")" = 700 ]] || \
        fail 'The existing backup directory must be owned by root with mode 700. Choose a new private directory.'
fi
DEST="$WEB_ROOT/modules/control_panel"
[[ ! -L "$DEST" ]] || fail 'Refusing to replace a symlink at the module destination.'
[[ ! -e "$DEST" || -d "$DEST" ]] || fail 'The module destination exists and is not a directory.'
for name in menu acl; do
    [[ -r "$DB_ROOT/$name.db" && -w "$DB_ROOT/$name.db" ]] || fail "Missing or unwritable Issabel database: $name.db"
done
id asterisk >/dev/null 2>&1 || fail 'The asterisk service account is missing.'
php -r '
    if (PHP_VERSION_ID < 70400) { fwrite(STDERR, "PHP 7.4 or newer is required\n"); exit(1); }
    foreach (array("sqlite3", "pdo_sqlite", "mysqli", "json", "session", "SimpleXML", "mbstring") as $extension) {
        if (!extension_loaded($extension)) { fwrite(STDERR, "Missing PHP extension: ".$extension."\n"); exit(1); }
    }
' || fail 'PHP prerequisites are not satisfied. Keep the Issabel PHP version; install its matching extension packages.'

if (( CHECK_ONLY )); then
    log 'Preflight passed. No changes were made.'
    exit 0
fi

exec 9>"$WEB_ROOT/modules/.mytel-operation-install.lock"
flock -n 9 || fail 'Another MyTel Operation installation is already running.'
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
SOURCE="$SCRIPT_DIR"
if [[ ! -f "$SOURCE/control.xml" || ! -d "$SOURCE/control_panel" || ! -d "$SOURCE/control_panel_en" ]]; then
    command -v curl >/dev/null 2>&1 || fail 'curl is required to download the public package.'
    [[ "$REPO" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || fail 'Invalid repository name.'
    [[ "$REF" =~ ^[A-Za-z0-9_./-]+$ && "$REF" != *..* ]] || fail 'Invalid repository ref.'
    WORK="$(mktemp -d /tmp/mytel-operation.XXXXXXXX)"
    log "Downloading $REPO ($REF) ..."
    curl --fail --silent --show-error --location --retry 2 --connect-timeout 15 --max-time 180 \
        "https://codeload.github.com/$REPO/tar.gz/$REF" -o "$WORK/package.tar.gz" || fail 'Download failed. Check DNS, HTTPS access and the release ref.'
    tar -tzf "$WORK/package.tar.gz" > "$WORK/contents" || fail 'The downloaded file is not a valid release archive.'
    if grep -Eq '(^/|(^|/)\.\.(/|$))' "$WORK/contents"; then fail 'Unsafe archive path.'; fi
    mkdir "$WORK/package"
    tar -xzf "$WORK/package.tar.gz" -C "$WORK/package" --strip-components=1 || fail 'Package extraction failed.'
    SOURCE="$WORK/package"
fi
[[ -f "$SOURCE/control.xml" && -f "$SOURCE/VERSION" ]] || fail 'The package is incomplete (menu definition or version missing).'

if [[ -z "$LANGUAGE" ]]; then
    LANGUAGE=en
    if [[ -t 0 ]]; then
        read -r -p 'Panel language: 1) English  2) Persian [1]: ' answer || true
        case "${answer:-1}" in
            1|en|'') LANGUAGE=en ;;
            2|fa) LANGUAGE=fa ;;
            *) fail 'Unsupported language choice (use 1 or 2).' ;;
        esac
    fi
fi
PANEL=control_panel
[[ "$LANGUAGE" = fa ]] || PANEL=control_panel_en
[[ -f "$SOURCE/$PANEL/index.php" && -f "$SOURCE/$PANEL/themes/default/panel.tpl" ]] || fail 'The selected panel package is incomplete.'

STAGE="$(mktemp -d "$WEB_ROOT/modules/.control_panel.stage.XXXXXXXX")"
cp -a -- "$SOURCE/$PANEL/." "$STAGE/"
if [[ -f "$DEST/libs/config.php" ]]; then
    [[ ! -L "$DEST/libs/config.php" ]] || fail 'The existing AMI configuration cannot be a symlink.'
    cp -p -- "$DEST/libs/config.php" "$STAGE/libs/config.php"
fi
while IFS= read -r -d '' file; do
    php -l "$file" >/dev/null || fail "PHP syntax validation failed: ${file#"$STAGE/"}"
done < <(find "$STAGE" -type f -name '*.php' -print0)
chown -R asterisk:asterisk "$STAGE"
find "$STAGE" -type d -exec chmod 755 {} +
find "$STAGE" -type f -exec chmod 644 {} +
[[ ! -f "$STAGE/libs/config.php" ]] || chmod 640 "$STAGE/libs/config.php"

if [[ ! -d "$BACKUP_ROOT" ]]; then install -d -m 700 -- "$BACKUP_ROOT"; fi
BACKUP="$(mktemp -d "$BACKUP_ROOT/backup-$(date +%Y%m%d-%H%M%S).XXXXXXXX")"
chmod 700 "$BACKUP"
for name in menu acl; do database_copy "$DB_ROOT/$name.db" "$BACKUP/$name.db"; done
if [[ -f "$DB_ROOT/control_panel_design.db" ]]; then
    DESIGN_EXISTED=1
    database_copy "$DB_ROOT/control_panel_design.db" "$BACKUP/control_panel_design.db"
fi
if [[ -d "$DEST" ]]; then tar -czf "$BACKUP/control_panel.tar.gz" -C "$WEB_ROOT/modules" control_panel; fi
cp -- "$SOURCE/control.xml" "$BACKUP/control.xml"
printf 'version=%s\nlanguage=%s\ndocument_root=%s\ndatabase_directory=%s\n' \
    "$(tr -d '\r\n' < "$SOURCE/VERSION")" "$LANGUAGE" "$WEB_ROOT" "$DB_ROOT" > "$BACKUP/install.txt"
{
    cat <<'RECOVERY'
MyTel Operation — manual recovery

The installer restores this snapshot automatically if installation fails.
For a later manual rollback, use a maintenance window and close Issabel/panel
sessions. Restoring menu/ACL databases can revert unrelated changes made after
this snapshot. Retain a fresh copy of the current databases before proceeding.
Use the immediately preceding installation backup.

Original document root and database paths, followed by shell commands:
RECOVERY
    printf 'Document root: %s\nDatabase directory: %s\nBackup: %s\n\n' "$WEB_ROOT" "$DB_ROOT" "$BACKUP"
    printf 'backup=%q\ndbdir=%q\nmodule=%q\n' "$BACKUP" "$DB_ROOT" "$DEST"
    cat <<'RECOVERY'

# Preserve the current module rather than deleting it. The path is private.
if [ -d "$module" ]; then
  mv -- "$module" "$backup/current-module-before-restore-$(date +%Y%m%d-%H%M%S)"
fi
RECOVERY
    if [[ -f "$BACKUP/control_panel.tar.gz" ]]; then
        printf 'tar -xzf "$backup/control_panel.tar.gz" -C %q\n' "$WEB_ROOT/modules"
        printf 'chown -R asterisk:asterisk -- "$module"\n'
    else
        printf '# There was no previous control_panel module. Moving it away restores that state.\n'
    fi
    cat <<'RECOVERY'

# SQLite online restore avoids replacing a database file beneath open handles.
# First snapshot the CURRENT databases to a new private directory.
before="$(mktemp -d "$backup/before-manual-restore.XXXXXXXX")"
chmod 700 "$before"
for name in menu acl control_panel_design; do
  [ -f "$backup/$name.db" ] || continue
  php -r '
    $src = new SQLite3($argv[1], SQLITE3_OPEN_READONLY);
    $dst = new SQLite3($argv[2]);
    $src->busyTimeout(10000); $dst->busyTimeout(10000);
    if (!$src->backup($dst)) { exit(1); }
  ' "$dbdir/$name.db" "$before/$name.db" || exit 1
  php -r '
    $src = new SQLite3($argv[1], SQLITE3_OPEN_READONLY);
    $dst = new SQLite3($argv[2]);
    $src->busyTimeout(10000); $dst->busyTimeout(10000);
    if (!$src->backup($dst)) { exit(1); }
  ' "$backup/$name.db" "$dbdir/$name.db" || exit 1
done

If this backup has no control_panel_design.db, that database did not exist
before installation. Keep any newly collected layout data until reviewed.
Do not change /etc/amportal.conf, SIP configuration or user identities.
Verify Issabel login, the menu entry and a PBX snapshot after recovery.
RECOVERY
} > "$BACKUP/README-restore.txt"
log "Backup saved: $BACKUP"

DATABASES_CHANGED=1
php -r '
    $db = new SQLite3($argv[1]); $db->busyTimeout(10000); $db->enableExceptions(true);
    try {
        $db->exec("BEGIN IMMEDIATE");
        $db->exec("CREATE TABLE IF NOT EXISTS area (id INTEGER PRIMARY KEY, name VARCHAR(80), height INTEGER, width INTEGER, description VARCHAR(100), no_column INTEGER, color VARCHAR(7))");
        $db->exec("CREATE TABLE IF NOT EXISTS item_box (id INTEGER PRIMARY KEY, id_area INTEGER, id_device INTEGER, FOREIGN KEY(id_area) REFERENCES area(id))");
        $columns = $db->query("PRAGMA table_info(area)"); $hasColor = false;
        while ($column = $columns->fetchArray(SQLITE3_ASSOC)) { if ($column["name"] === "color") $hasColor = true; }
        $columns->finalize();
        if (!$hasColor) $db->exec("ALTER TABLE area ADD COLUMN color VARCHAR(7) DEFAULT \x27#E0FFEF\x27");
        $defaults = array(
            array("Extension", 232, 608, "Extensions", 3, "#DEE4FA"),
            array("Queues", 100, 380, "Queues", 2, "#FED0CF"),
            array("Trunks", 271, 608, "DAHDI Trunks", 3, "#D0FFD0"),
            array("TrunksSIP", 271, 608, "SIP/IAX Trunks", 3, "#D0FFFF"),
            array("Conferences", 100, 380, "Conferences", 2, "#DACCCA"),
            array("Parkinglots", 229, 380, "Parking lots", 2, "#F5F5DC")
        );
        for ($i = 1; $i <= 9; $i++) $defaults[] = array("Area".$i, 100, 380, "Area ".$i, 2, "#E0FFEF");
        $find = $db->prepare("SELECT id FROM area WHERE name = ?");
        $insert = $db->prepare("INSERT INTO area (name,height,width,description,no_column,color) VALUES (?,?,?,?,?,?)");
        foreach ($defaults as $row) {
            $find->reset(); $find->bindValue(1, $row[0], SQLITE3_TEXT);
            $result = $find->execute(); $exists = $result->fetchArray(SQLITE3_NUM); $result->finalize();
            if ($exists !== false) continue;
            $insert->reset();
            foreach ($row as $offset => $value) $insert->bindValue($offset + 1, $value, is_int($value) ? SQLITE3_INTEGER : SQLITE3_TEXT);
            $insert->execute();
        }
        $db->exec("COMMIT");
    } catch (Throwable $error) {
        $db->exec("ROLLBACK"); fwrite(STDERR, "Cannot initialize panel layout schema\n"); exit(1);
    }
' "$DB_ROOT/control_panel_design.db"
chown asterisk:asterisk "$DB_ROOT/control_panel_design.db"
chmod 644 "$DB_ROOT/control_panel_design.db"

if [[ -d "$DEST" ]]; then
    PREVIOUS="$WEB_ROOT/modules/.control_panel.previous.$$"
    [[ ! -e "$PREVIOUS" ]] || fail 'A previous staging directory already exists.'
    mv -- "$DEST" "$PREVIOUS"
fi
# Both paths share a filesystem; the prepared directory is renamed into place.
if ! mv -- "$STAGE" "$DEST"; then
    [[ -z "$PREVIOUS" ]] || mv -- "$PREVIOUS" "$DEST"
    fail 'Unable to activate the prepared module.'
fi
STAGE=""
SWAPPED=1
if ! ISSABEL_ROOT="$WEB_ROOT" issabel-menumerge "$SOURCE/control.xml" >"$BACKUP/menu-merge.log" 2>&1; then
    cat "$BACKUP/menu-merge.log" >&2
    fail "Issabel menu registration failed. See $BACKUP/menu-merge.log"
fi
php -r '
    $menu = new SQLite3($argv[1]."/menu.db", SQLITE3_OPEN_READONLY);
    $acl = new SQLite3($argv[1]."/acl.db", SQLITE3_OPEN_READONLY);
    $registered = $menu->querySingle("SELECT COUNT(*) FROM menu WHERE id=\x27control_panel\x27 AND IdParent=\x27pbxconfig\x27");
    $allowed = $acl->querySingle("SELECT COUNT(*) FROM acl_resource r JOIN acl_group_permission p ON p.id_resource=r.id JOIN acl_group g ON g.id=p.id_group WHERE r.name=\x27control_panel\x27 AND g.name=\x27administrator\x27");
    if (!$registered || !$allowed) { fwrite(STDERR, "Menu or administrator permission verification failed\n"); exit(1); }
    $definitions = simplexml_load_file($argv[2]);
    if (!$definitions) exit(1);
    $query = $acl->prepare("SELECT 1 FROM acl_module_privileges p
        JOIN acl_resource r ON r.id=p.id_resource
        JOIN acl_module_group_permissions gp ON gp.id_module_privilege=p.id
        JOIN acl_group g ON g.id=gp.id_group
        WHERE r.name=:module AND g.name=:group AND p.privilege=:permission");
    if (!$query) exit(1);
    foreach ($definitions->menulist->menuitem->privilege as $privilege) {
        $query->reset();
        $query->bindValue(":module", "control_panel", SQLITE3_TEXT);
        $query->bindValue(":group", "administrator", SQLITE3_TEXT);
        $query->bindValue(":permission", (string)$privilege["name"], SQLITE3_TEXT);
        $row = $query->execute();
        if (!$row || !$row->fetchArray(SQLITE3_NUM)) {
            fwrite(STDERR, "MyTel action privilege registration failed\n");
            exit(1);
        }
    }
' "$DB_ROOT" "$SOURCE/control.xml"
if command -v restorecon >/dev/null 2>&1; then restorecon -R "$DEST"; fi
[[ -z "$PREVIOUS" || ! -d "$PREVIOUS" ]] || rm -rf -- "$PREVIOUS"
SWAPPED=0
DATABASES_CHANGED=0
log "Installation complete: MyTel Operation $(tr -d '\r\n' < "$SOURCE/VERSION") ($LANGUAGE)"
log 'Open Issabel > PBX > MyTel Operation, or index.php?menu=control_panel after signing in.'
log 'Asterisk, SIP settings, extensions and running calls were not restarted or reconfigured.'
