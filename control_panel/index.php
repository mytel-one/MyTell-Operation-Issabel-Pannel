<?php
// MyTel modifications, 2026-11-18: compatibility and request safety.

/*
  vim: set expandtab tabstop=4 softtabstop=4 shiftwidth=4:
  Codificación: UTF-8
  +----------------------------------------------------------------------+
  | Issabel version 1.6-3                                               |
  | http://www.issabel.org                                               |
  +----------------------------------------------------------------------+
  | Copyright (c) 2006 Palosanto Solutions S. A.                         |
  +----------------------------------------------------------------------+
  | The contents of this file are subject to the General Public License  |
  | (GPL) Version 2 (the "License"); you may not use this file except in |
  | compliance with the License. You may obtain a copy of the License at |
  | http://www.opensource.org/licenses/gpl-license.php                   |
  |                                                                      |
  | Software distributed under the License is distributed on an "AS IS"  |
  | basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See  |
  | the License for the specific language governing rights and           |
  | limitations under the License.                                       |
  +----------------------------------------------------------------------+
  | The Initial Developer of the Original Code is PaloSanto Solutions    |
  +----------------------------------------------------------------------+
  $Id: index.php,v 1.1 2007/01/09 23:49:36 alex Exp $
*/

require_once "libs/paloSantoJSON.class.php";

function _moduleContent(&$smarty, $module_name)
{
    require_once "modules/$module_name/configs/default.conf.php";
    require_once "modules/$module_name/libs/paloInterfaceSSE.class.php";
    require_once "modules/$module_name/libs/paloServerSentEvents.class.php";
    require_once "modules/$module_name/libs/paloControlPanelUtils.class.php";


    load_language_module($module_name);

    global $arrConf;
    global $arrConfModule;
    $arrConf = array_merge($arrConf,$arrConfModule);



    //folder path for custom templates
    $base_dir = dirname($_SERVER['SCRIPT_FILENAME']);
    $templates_dir = (isset($arrConf['templates_dir']))?$arrConf['templates_dir']:'themes';
    $local_templates_dir = "$base_dir/modules/$module_name/".$templates_dir.'/'.$arrConf['theme'];

    require_once __DIR__ . '/libs/mytelRequestSecurity.php';
    require_once __DIR__ . '/libs/mytelOperatorAccess.php';
    global $pACL;
    if (empty($_SESSION[$module_name]['csrfToken']))
        $_SESSION[$module_name]['csrfToken'] = bin2hex(random_bytes(32));

    // Valores estáticos comunes a todas las operaciones
    $smarty->assign('module_name', $module_name);

    $h = 'handleHTML_mainReport';
    if (isset($_REQUEST['action'])) {
        $action = $_REQUEST['action'];
        $readActions = array('pbxSnapshot', 'pbxStatus');
        $writeActions = array('pbxStatusShutdown', 'updateExtensionPanel', 'updatePanelDesc',
            'updatePanelSize', 'callExtension', 'hangupExtension', 'hangupChannel', 'voicemailExtension', 'transferChannel', 'consultTransferChannel', 'parkChannel', 'pickupChannel', 'toggleQueueMemberPause', 'joinQueueMember', 'leaveQueueMember');
        if (!is_string($action) || !in_array($action, array_merge($readActions, $writeActions), TRUE))
            return handleJSON_unimplemented($smarty, $module_name, $local_templates_dir);
        if (in_array($action, $writeActions, TRUE)) {
            $token = isset($_SERVER['HTTP_X_MYTEL_CSRF']) ? $_SERVER['HTTP_X_MYTEL_CSRF'] : NULL;
            if (!mytelAuthorizeMutation(isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : '',
                $_SESSION[$module_name]['csrfToken'], $token))
                return mytelJSONError('Request verification failed. Reload the panel and try again.', 403);
            if (!mytelPermitAction($pACL, $_SESSION['issabel_user'] ?? '', $action)) {
                mytelLogControl($_SESSION['issabel_user'] ?? '', $action, 'denied');
                return mytelJSONError('Your account does not have permission for this operation.', 403);
            }
            if (!mytelValidateMutation($action, $_POST))
                return mytelJSONError('Invalid or missing parameters.', 400);
            // Handler input comes from the validated POST body, never query-string overrides.
            foreach ($_POST as $key => $value) $_REQUEST[$key] = $value;
            if (in_array($action, array('callExtension', 'hangupExtension', 'hangupChannel', 'voicemailExtension', 'transferChannel', 'consultTransferChannel', 'parkChannel', 'pickupChannel', 'toggleQueueMemberPause', 'joinQueueMember', 'leaveQueueMember'), TRUE))
                session_write_close();
        }
        $h = 'handleJSON_' . $action;
    } elseif (!checkAreas()) {
        return '<div class="mytel-setup-error" role="alert">' .
            htmlspecialchars(_tr('Panel database is unavailable. Ask the administrator to run the MyTel installer.'), ENT_QUOTES, 'UTF-8') . '</div>';
    }
    $response = call_user_func($h, $smarty, $module_name, $local_templates_dir);
    if (isset($action) && isset(mytelActionPrivileges()[$action])) {
        $result = json_decode($response, TRUE);
        mytelLogControl($_SESSION['issabel_user'] ?? '', $action,
            ($result['status'] ?? '') === 'success' ? 'accepted' : 'failed');
    }
    return $response;
}

function mytelJSONError($message, $status = 400)
{
    http_response_code($status);
    Header('Content-Type: application/json');
    Header('Cache-Control: no-store');
    $json = new Services_JSON();
    return $json->encode(array('status' => 'error', 'message' => _tr($message)));
}

function handleJSON_unimplemented($smarty, $module_name, $local_templates_dir)
{
    $json = new Services_JSON();
    Header('Content-Type: application/json');
    return $json->encode(array(
        'status'    =>  'error',
        'message'   =>  _tr('Unimplemented method'),
    ));
}




function handleHTML_mainReport($smarty, $module_name, $local_templates_dir)
{

    //obtenemos la extension actual del usuario activo
    global $arrConf;



$smarty->assign(array(
        'title' => _tr('Control Panel'),
        'LBL_EDIT_NAME' => _tr('Edit Name'),
        'LBL_SAVE_NAME' => _tr('Save'),
        'icon' => 'modules/'.$module_name.'/images/pbx_operator_panel.png',
        'LBL_NEW' => _tr('New'),
        'LBL_OLD' => _tr('Old'),
        // ... بقیه خطوط قبلی ...

        // ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
        // فارسی‌سازی کامل عنوان بخش‌ها - نسخه ۱۰۰٪ بدون خطا
        'TITLE_EXTENSIONS'      => 'داخلی‌ها',
        'TITLE_QUEUES'          => 'صف‌ها',
        'TITLE_CONFERENCES'     => 'کنفرانس‌ها',
        'TITLE_PARKINGLOTS'     => 'پارکینگ تماس',
        'TITLE_TRUNKS'          => 'ترانک‌های SIP/IAX',
        'TITLE_CUSTOMERS_QUEUE' => 'مشتریان در صف:',
        'TITLE_AGENTS'          => 'اپراتورها',
        'TITLE_EDIT_NAME'       => 'ویرایش نام',
        'TITLE_AREA_1'          => 'منطقه ۱',
        'TITLE_AREA_2'          => 'منطقه ۲',
        // ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
    ));

    global $pACL;
    $operator = $_SESSION['issabel_user'] ?? '';
    // Inicialización del estado del módulo
    paloServerSentEvents::generarEstadoHash($module_name, array());
    $pUtils = new paloControlPanelUtils();
    $areaProp = $pUtils->loadAreaProperties();
    if (!is_array($areaProp)) return '<div class="mytel-setup-error" role="alert">' . htmlspecialchars(_tr('Panel database is unavailable. Run the MyTel installer.'), ENT_QUOTES, 'UTF-8') . '</div>';
    foreach (array_keys($areaProp) as $k)
        $areaProp[$k]['description'] = _tr($areaProp[$k]['description']);
    
    // Ember.js requiere jQuery 1.7.2 o superior.
    modificarReferenciasLibreriasJS($smarty, $module_name);

    $json = new Services_JSON();

    $smarty->assign(array(
        'title'                     =>  _tr('Control Panel'),
        'LBL_EDIT_NAME'             =>  _tr('Edit Name'),
        'LBL_SAVE_NAME'             =>  _tr('Save'),
        'icon'                      =>  'modules/'.$module_name.'/images/pbx_operator_panel.png',
        'LBL_NEW'                   =>  _tr('New'),
        'LBL_OLD'                   =>  _tr('Old'),
        'LBL_QUEUE_MEMBERS'         =>  _tr('Members'),
        'LBL_QUEUE_NO_MEMBERS'      =>  _tr('Not Attended'),
        'LBL_QUEUE_CALLERS'         =>  _tr('Callers'),
        'LBL_QUEUE_NO_CALLERS'      =>  _tr('No Callers'),
        'LBL_CONF_PARTICIPANTS'     =>  _tr('Participant(s)'),
        'LBL_PARKED'                =>  _tr('Parked'),
        'ARRLANG_MAIN'              =>  $json->encode(array(
            'LBL_HIDE_ALL'      =>  _tr('Hide All'),
            'LBL_SHOW_ALL'      =>  _tr('Show All'),
        )),
        'VAR_INIT'                  =>  json_encode(array(
            'ESTADO_CLIENTE_HASH'   =>  $_SESSION[$module_name]['estadoClienteHash'],
            'ESTADO_PANELES'        =>  $areaProp,
            'TIMESTAMP_START'       =>  time(),
            'OPERATOR_ACCESS'         => mytelOperatorCapabilities($pACL, $operator),
            'OPERATOR_TOOLS'          => mytelOperatorTools($pACL, $operator, dirname($_SERVER['SCRIPT_FILENAME'])),
            'OPERATOR_KEY'            => hash('sha256', $operator),
            'CSRF_TOKEN'            =>  $_SESSION[$module_name]['csrfToken'],
	   

        ), JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT),
    ));
    foreach ($areaProp as $k => $tupla) {
    	$smarty->assign('AREA_DESCR_'.strtoupper($k), $tupla['description']);
    }
    $c = $smarty->fetch($local_templates_dir.'/panel.tpl');
    
    return $c;
}

// A short request returning a fresh, complete snapshot. Authentication has
// already run in Issabel; release its session lock before querying the PBX.
function handleJSON_pbxSnapshot($smarty, $module_name, $local_templates_dir)
{
    session_write_close();
    Header('Content-Type: application/json');
    Header('Cache-Control: no-store');
    require_once "modules/$module_name/libs/paloControlPanelStatus.class.php";
    $panel = NULL;
    try {
        $panel = new paloControlPanelStatus(TRUE);
        $response = $panel->snapshot();
        if (isset($response['error']))
            $response['error'] = _tr('Unable to load the current PBX state. Check the PBX connection and try again.');
    } catch (Throwable $error) {
        error_log('[MyTel] PBX snapshot failed; verify database and AMI configuration.');
        $response = array('snapshot' => TRUE, 'pbxchanges' => array(), 'timestamp' => time(),
            'error' => _tr('Unable to load the current PBX state. Check the PBX connection and try again.'));
    } finally {
        if (!is_null($panel)) $panel->shutdown();
    }
    $json = new Services_JSON();
    return $json->encode($response);
}

function handleJSON_pbxStatus($smarty, $module_name, $local_templates_dir)
{
    require_once "modules/$module_name/libs/paloControlPanelStatus.class.php";

    $paloSSE = new paloServerSentEvents($module_name, 'paloControlPanelStatus');
    $paloSSE->handle();
    return '';
}

function handleJSON_pbxStatusShutdown($smarty, $module_name, $local_templates_dir)
{
    $respuesta = array(
        'status'    =>  'success',
        'message'   =>  '(no message)',
    );
    
	$_SESSION[$module_name]['finalizarEscucha'] = TRUE;
    
    $json = new Services_JSON();
    Header('Content-Type: application/json');
    return $json->encode($respuesta);
}



function handleJSON_updateExtensionPanel($smarty, $module_name, $local_templates_dir)
{
    $respuesta = array(
        'status'    =>  'success',
        'message'   =>  '(no message)',
    );
    
    if (!isset($_REQUEST['panel']) || !isset($_REQUEST['extension'])) {
    	$respuesta['status'] = 'error';
        $respuesta['message'] = _tr('Invalid or missing parameters');
    } else {
        $pUtils = new paloControlPanelUtils();
        if (!$pUtils->updateExtensionPanel($_REQUEST['panel'], $_REQUEST['extension'])) {
            $respuesta['status'] = 'error';
            $respuesta['message'] = $pUtils->errMsg;
        }
    }
    
    $json = new Services_JSON();
    Header('Content-Type: application/json');
    return $json->encode($respuesta);
}

function handleJSON_updatePanelDesc($smarty, $module_name, $local_templates_dir)
{
    $respuesta = array(
        'status'    =>  'success',
        'message'   =>  '(no message)',
    );

    if (!isset($_REQUEST['panel']) || !isset($_REQUEST['description'])) {
        $respuesta['status'] = 'error';
        $respuesta['message'] = _tr('Invalid or missing parameters');
    } else {
        $pUtils = new paloControlPanelUtils();
        if (!$pUtils->updatePanelDesc($_REQUEST['panel'], $_REQUEST['description'])) {
            $respuesta['status'] = 'error';
            $respuesta['message'] = $pUtils->errMsg;
        }
    }
    
    $json = new Services_JSON();
    Header('Content-Type: application/json');
    return $json->encode($respuesta);
}

function handleJSON_updatePanelSize($smarty, $module_name, $local_templates_dir)
{
    $respuesta = array(
        'status'    =>  'success',
        'message'   =>  '(no message)',
    );

    if (!isset($_REQUEST['panelgroup']) || !isset($_REQUEST['width'])) {
        $respuesta['status'] = 'error';
        $respuesta['message'] = _tr('Invalid or missing parameters');
    } else {
        $pUtils = new paloControlPanelUtils();
        if (!$pUtils->updatePanelSize($_REQUEST['panelgroup'], $_REQUEST['width'])) {
            $respuesta['status'] = 'error';
            $respuesta['message'] = $pUtils->errMsg;
        }
    }
    
    $json = new Services_JSON();
    Header('Content-Type: application/json');
    return $json->encode($respuesta);
}

function handleJSON_callExtension($smarty, $module_name, $local_templates_dir)
{
    $respuesta = array(
        'status'    =>  'success',
        'message'   =>  '(no message)',
    );

    if (!isset($_REQUEST['source']) || !isset($_REQUEST['target'])) {
        $respuesta['status'] = 'error';
        $respuesta['message'] = _tr('Invalid or missing parameters');
    } else {
        $pUtils = new paloControlPanelUtils();
        if (!$pUtils->callExtension($_REQUEST['source'], $_REQUEST['target'])) {
            $respuesta['status'] = 'error';
            $respuesta['message'] = $pUtils->errMsg;
        }
    }
    
    $json = new Services_JSON();
    Header('Content-Type: application/json');
    return $json->encode($respuesta);
}

function handleJSON_hangupExtension($smarty, $module_name, $local_templates_dir)
{
    $respuesta = array(
        'status'    =>  'success',
        'message'   =>  '(no message)',
    );

    if (!isset($_REQUEST['target'])) {
        $respuesta['status'] = 'error';
        $respuesta['message'] = _tr('Invalid or missing parameters');
    } else {
        $pUtils = new paloControlPanelUtils();
        if (!$pUtils->hangupExtension($_REQUEST['target'])) {
            $respuesta['status'] = 'error';
            $respuesta['message'] = $pUtils->errMsg;
        }
    }
    
    $json = new Services_JSON();
    Header('Content-Type: application/json');
    return $json->encode($respuesta);
}

function handleJSON_hangupChannel($smarty, $module_name, $local_templates_dir)
{
    $utils = new paloControlPanelUtils();
    $success = $utils->hangupChannel($_POST['channel'], $_POST['uniqueid']);
    Header('Content-Type: application/json');
    Header('Cache-Control: no-store');
    $json = new Services_JSON();
    return $json->encode(array('status'=>$success ? 'success' : 'error',
        'message'=>$success ? 'The selected call was ended.' : $utils->errMsg));
}

// Every operator control reaches this wrapper only after Issabel ACL, POST,
// CSRF, scalar validation and privilege checks in _moduleContent.
function mytelOperatorControlResponse($operation)
{
    require_once __DIR__ . '/libs/mytelCallActionService.php';
    require_once __DIR__ . '/libs/mytelQueueMemberService.php';
    $ami = new AGI_AsteriskManager2();
    $deadline = microtime(TRUE) + 5;
    $ami->setDeadline($deadline);
    $database = NULL;
    $success = FALSE;
    $memberInterface = NULL;
    $message = 'The PBX operation could not be confirmed. Refresh before trying again.';
    try {
        if (!$ami->connect('localhost', 'admin', obtenerClaveAMIAdmin(), 'off')) {
            $message = 'Unable to connect to the PBX. Try again.';
        } elseif (in_array($operation, array('toggleQueueMemberPause','joinQueueMember','leaveQueueMember'), TRUE)) {
            if ($operation === 'joinQueueMember') $database = new paloDB(generarDSNSistema('asteriskuser', 'asterisk'));
            $service = new MytelQueueMemberService($ami, $deadline, $database);
            if ($operation === 'toggleQueueMemberPause') {
                $success = $service->setPaused($_POST['queue'], $_POST['interface'], $_POST['paused']);
                $message = $success ? ($service->changed ? 'The queue member pause state was updated.' : 'The queue member already has the requested state.') : $service->errMsg;
            } elseif ($operation === 'joinQueueMember') {
                $success = $service->join($_POST['queue'], $_POST['source']);
                $memberInterface = isset($service->memberInterface) ? $service->memberInterface : NULL;
                $message = $success ? ($service->changed ? 'The queue sign-in request was accepted.' : 'This operator is already a member of the queue.') : $service->errMsg;
            } else {
                $success = $service->leave($_POST['queue'], $_POST['interface']);
                $message = $success ? 'The queue sign-out request was accepted.' : $service->errMsg;
            }
        } else {
            $database = new paloDB(generarDSNSistema('asteriskuser', 'asterisk'));
            $service = new MytelCallActionService($ami, $database, $deadline);
            if ($operation === 'transferChannel' || $operation === 'consultTransferChannel') {
                $consult = $operation === 'consultTransferChannel';
                $success = $service->transferChannel($_POST['channel'], $_POST['uniqueid'], $_POST['target'], $consult);
                $message = $success ? ($consult ? 'Consultation transfer requested. Complete or cancel using your phone transfer controls.' : 'The transfer request was accepted by the PBX.') : $service->errMsg;
            } elseif ($operation === 'parkChannel') {
                $success = $service->parkChannel($_POST['channel'], $_POST['uniqueid'], $_POST['lot']);
                $message = $success ? 'The parking request was accepted. Check the live parking slots.' : $service->errMsg;
            } elseif ($operation === 'pickupChannel') {
                $success = $service->pickupChannel($_POST['channel'], $_POST['uniqueid'], $_POST['source']);
                $message = $success ? 'Pickup requested. Answer your operator extension.' : $service->errMsg;
            }
        }
    } catch (Throwable $error) {
        $success = FALSE;
        $message = 'The PBX operation could not be confirmed. Check live status before retrying.';
    } finally {
        $ami->disconnect();
        if ($database) $database->disconnect();
    }
    Header('Content-Type: application/json');
    Header('Cache-Control: no-store');
    $json = new Services_JSON();
    return $json->encode(array('status'=>$success ? 'success' : 'error', 'message'=>$message, 'member_interface'=>$memberInterface));
}

function handleJSON_transferChannel($smarty, $module_name, $local_templates_dir) { return mytelOperatorControlResponse('transferChannel'); }
function handleJSON_consultTransferChannel($smarty, $module_name, $local_templates_dir) { return mytelOperatorControlResponse('consultTransferChannel'); }
function handleJSON_parkChannel($smarty, $module_name, $local_templates_dir) { return mytelOperatorControlResponse('parkChannel'); }
function handleJSON_pickupChannel($smarty, $module_name, $local_templates_dir) { return mytelOperatorControlResponse('pickupChannel'); }
function handleJSON_toggleQueueMemberPause($smarty, $module_name, $local_templates_dir) { return mytelOperatorControlResponse('toggleQueueMemberPause'); }
function handleJSON_joinQueueMember($smarty, $module_name, $local_templates_dir) { return mytelOperatorControlResponse('joinQueueMember'); }
function handleJSON_leaveQueueMember($smarty, $module_name, $local_templates_dir) { return mytelOperatorControlResponse('leaveQueueMember'); }

function handleJSON_voicemailExtension($smarty, $module_name, $local_templates_dir)
{
    $respuesta = array(
        'status'    =>  'success',
        'message'   =>  '(no message)',
    );

    if (!isset($_REQUEST['source'])) {
        $respuesta['status'] = 'error';
        $respuesta['message'] = _tr('Invalid or missing parameters');
    } else {
        $pUtils = new paloControlPanelUtils();
        if (!$pUtils->callExtensionVoicemail($_REQUEST['source'])) {
            $respuesta['status'] = 'error';
            $respuesta['message'] = $pUtils->errMsg;
        }
    }
    
    $json = new Services_JSON();
    Header('Content-Type: application/json');
    return $json->encode($respuesta);
}

function modificarReferenciasLibreriasJS($smarty, $module_name)
{
    $listaLibsJS_framework = explode("\n", $smarty->get_template_vars('HEADER_LIBS_JQUERY'));
    $listaLibsJS_modulo = explode("\n", $smarty->get_template_vars('HEADER_MODULES'));

    /* Se busca la referencia a jQuery (se asume que sólo hay una biblioteca que
     * empieza con "jquery-") y se la quita. Las referencias a Ember.js y 
     * Handlebars se reordenan para que Handlebars aparezca antes que Ember.js 
     */ 
    $sEmberRef = $sHandleBarsRef = $sjQueryRef = NULL;
    foreach (array_keys($listaLibsJS_modulo) as $k) {
        // Issabel automatically includes every stylesheet and script here.
        // panel.tpl loads these assets in dependency order with release versions.
        // A second copy would bind two click handlers to a single call action.
        if (preg_match('~themes/default/(?:js/mytel-(?:ui|call-model|calls|queue-controls)\.js|css/mytel(?:-queue-controls)?\.css)[\x22\x27?]~', $listaLibsJS_modulo[$k])) {
            unset($listaLibsJS_modulo[$k]);
        } elseif (strpos($listaLibsJS_modulo[$k], 'themes/default/js/javascript.js') !== FALSE) {
            $listaLibsJS_modulo[$k] = str_replace('javascript.js', 'javascript.js?v=2.1.0', $listaLibsJS_modulo[$k]);
        } elseif (strpos($listaLibsJS_modulo[$k], 'themes/default/js/jquery-') !== FALSE) {
            $sjQueryRef = $listaLibsJS_modulo[$k];
            unset($listaLibsJS_modulo[$k]);
        } elseif (strpos($listaLibsJS_modulo[$k], 'themes/default/js/handlebars-') !== FALSE) {
            $sHandleBarsRef = $listaLibsJS_modulo[$k];
            unset($listaLibsJS_modulo[$k]);
        } elseif (strpos($listaLibsJS_modulo[$k], 'themes/default/js/ember-') !== FALSE) {
            $sEmberRef = $listaLibsJS_modulo[$k];
            unset($listaLibsJS_modulo[$k]);
        }
    }
    array_unshift($listaLibsJS_modulo, $sEmberRef);
    array_unshift($listaLibsJS_modulo, $sHandleBarsRef);
    
    $smarty->assign('HEADER_MODULES', implode("\n", $listaLibsJS_modulo));

    /* Se busca la referencia original al jQuery del framework, y se reemplaza
     * si es más vieja que el jQuery del módulo */
    $sRegexp = '/jquery-(\d.+?)(\.min)?\.js/'; $regs = NULL;
    if (!is_null($sjQueryRef)) preg_match($sRegexp, $sjQueryRef, $regs);
    $sVersionModulo = isset($regs[1]) ? $regs[1] : NULL;
    $sVersionFramework = NULL;
    foreach (array_keys($listaLibsJS_framework) as $k) {
        if (preg_match($sRegexp, $listaLibsJS_framework[$k], $regs)) {
            $sVersionFramework = $regs[1];
            if (is_null($sVersionModulo)) continue;

            // Se asume que la versión sólo consiste de números y puntos
            $verFramework = explode('.', $sVersionFramework);
            $verModulo = explode('.', $sVersionModulo);
            while (count($verFramework) < count($verModulo)) $verFramework[] = "0";
            while (count($verFramework) > count($verModulo)) $verModulo[] = "0";
            if ($verModulo > $verFramework) $listaLibsJS_framework[$k] = $sjQueryRef;
        }
    }
    $smarty->assign('HEADER_LIBS_JQUERY', implode("\n", $listaLibsJS_framework));


    
}

function checkAreas($databasePath = NULL)
{
    global $arrConf;
    if (is_null($databasePath)) {
        $directory = isset($arrConf['issabel_dbdir']) ? $arrConf['issabel_dbdir'] : '/var/www/db';
        $databasePath = $directory . '/control_panel_design.db';
    }
    if (!is_file($databasePath)) return FALSE;
    $db = NULL;
    try {
        $db = new SQLite3($databasePath, SQLITE3_OPEN_READWRITE);
        if (!$db->busyTimeout(2000) || !$db->exec('BEGIN IMMEDIATE')) return FALSE;
        $find = $db->prepare('SELECT id FROM area WHERE name = ?');
        $insert = $db->prepare('INSERT INTO area (name, height, width, description, no_column, color) VALUES (?, 100, 1070, ?, 5, ?)');
        if (!$find || !$insert) throw new RuntimeException('Missing panel database schema');
        for ($i = 1; $i <= 9; $i++) {
            $find->reset();
            $find->bindValue(1, 'Area' . $i, SQLITE3_TEXT);
            $result = $find->execute();
            $existing = $result->fetchArray(SQLITE3_NUM);
            $result->finalize();
            if ($existing !== FALSE) continue;
            $insert->reset();
            $insert->bindValue(1, 'Area' . $i, SQLITE3_TEXT);
            $insert->bindValue(2, 'Area ' . $i, SQLITE3_TEXT);
            $insert->bindValue(3, '#E0FFEF', SQLITE3_TEXT);
            if (!$insert->execute()) throw new RuntimeException('Unable to create panel area');
        }
        if (!$db->exec('COMMIT')) throw new RuntimeException('Unable to commit panel areas');
        return TRUE;
    } catch (Throwable $error) {
        if ($db) $db->exec('ROLLBACK');
        error_log('[MyTel] Panel database initialization failed. Run the installer to repair the schema.');
        return FALSE;
    } finally {
        if ($db) $db->close();
    }
}
?>
