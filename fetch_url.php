<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

$url = $_GET['url'] ?? '';
if (!$url) {
  echo json_encode(['error' => 'Missing url parameter']);
  exit;
}

$host = parse_url($url, PHP_URL_HOST);
if (!$host) {
  echo json_encode(['error' => 'Invalid url']);
  exit;
}

// ---- Rate limiting & domain block state ----
$rateFile = sys_get_temp_dir() . '/fetch_proxy_rate.json';
$now = time();
$window = 60;
$maxPerWindow = 10;

$rateData = [];
if (is_file($rateFile)) {
  $fh = fopen($rateFile, 'r');
  if ($fh && flock($fh, LOCK_SH)) {
    $raw = stream_get_contents($fh);
    $rateData = json_decode($raw, true) ?: [];
    flock($fh, LOCK_UN);
    fclose($fh);
  }
}

$hostEntry = $rateData[$host] ?? ['requests' => [], 'blocked_until' => null];

// Prune stale entries for this host
$hostEntry['requests'] = array_values(array_filter($hostEntry['requests'], function($t) use ($now, $window) {
  return $t > $now - $window;
}));

// Check domain block (circuit breaker from previous 429)
if ($hostEntry['blocked_until'] && $hostEntry['blocked_until'] > $now) {
  echo json_encode([
    'error' => 'Domain temporarily blocked due to previous 429',
    'status' => 429,
    'retry_after' => $hostEntry['blocked_until'] - $now,
  ]);
  exit;
}

// Check rate limit
if (count($hostEntry['requests']) >= $maxPerWindow) {
  $oldest = $hostEntry['requests'][0];
  echo json_encode([
    'error' => 'Rate limit exceeded for this domain',
    'status' => 429,
    'retry_after' => $oldest + $window - $now,
  ]);
  exit;
}

// ---- Rotating User-Agent & Referer ----
$userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Mozilla/5.0 (compatible; DuckDuckBot/1.1; +https://duckduckgo.com/duckduckbot)',
];

$referers = [
  'https://www.google.com/',
  'https://www.bing.com/',
  'https://duckduckgo.com/',
  'https://lobste.rs/',
  'https://news.ycombinator.com/',
  'https://www.reddit.com/',
  '',
];

$uaIdx = abs(crc32($host . date('Y-m-d-H'))) % count($userAgents);
$refIdx = abs(crc32($host . date('Y-m-d'))) % count($referers);

usleep(random_int(100000, 500000));

// ---- cURL ----
$responseHeaders = [];
$ch = curl_init();
curl_setopt_array($ch, [
  CURLOPT_URL => $url,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_FOLLOWLOCATION => true,
  CURLOPT_TIMEOUT => 30,
  CURLOPT_USERAGENT => $userAgents[$uaIdx],
  CURLOPT_REFERER => $referers[$refIdx],
  CURLOPT_HTTPHEADER => [
    'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language: en-US,en;q=0.5',
  ],
  CURLOPT_HEADERFUNCTION => function($ch, $line) use (&$responseHeaders) {
    $responseHeaders[] = $line;
    return strlen($line);
  },
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

// ---- Handle 429 / Retry-After ----
$retryAfter = null;

if ($httpCode === 429) {
  foreach ($responseHeaders as $h) {
    if (stripos($h, 'Retry-After:') === 0) {
      $val = trim(substr($h, 12));
      if (is_numeric($val)) {
        $retryAfter = (int)$val;
      } else {
        $parsed = strtotime($val);
        $retryAfter = $parsed !== false ? max(1, $parsed - $now) : 60;
      }
      break;
    }
  }
  $cooldown = $retryAfter ?? 60;
  $hostEntry['blocked_until'] = $now + $cooldown;
} else {
  $hostEntry['requests'][] = $now;
}

// Persist rate data
$rateData[$host] = $hostEntry;
$fh = fopen($rateFile, 'w');
if ($fh && flock($fh, LOCK_EX)) {
  fwrite($fh, json_encode($rateData));
  flock($fh, LOCK_UN);
  fclose($fh);
}

echo json_encode([
  'status' => $httpCode,
  'content_type' => $contentType,
  'content' => $content,
  'retry_after' => $retryAfter,
]);
