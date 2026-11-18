<?php
// Retired standalone endpoint. Queue data is provided by the authenticated,
// ACL-protected Issabel pbxSnapshot handler. Queue counters are never reset here.
http_response_code(410);
header('Content-Type: application/json');
header('Cache-Control: no-store');
echo json_encode(array('status' => 'error', 'message' => 'Use the authenticated panel snapshot endpoint.'));
