<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

$url = $_GET['url'] ?? '';
if (!$url) {
  echo json_encode(['error' => 'Missing url parameter']);
  exit;
}

$ch = curl_init();
curl_setopt_array($ch, [
  CURLOPT_URL => $url,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_FOLLOWLOCATION => true,
  CURLOPT_TIMEOUT => 30,
  CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; OpenCodeBot/1.0)',
]);
$content = curl_exec($ch);

if ($content === false) {
  $err = curl_error($ch);
  curl_close($ch);
  echo json_encode(['error' => 'cURL error: ' . $err]);
  exit;
}

$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
curl_close($ch);

echo json_encode(['status' => $httpCode, 'content_type' => $contentType, 'content' => $content]);
