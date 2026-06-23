async function parseProxyResponse(res) {
  var text = await res.text();
  try {
    var json = JSON.parse(text);
    if (json.content !== undefined || json.error !== undefined || json.status !== undefined) {
      return json;
    }
  } catch {}
  return { content: text, status: res.status, content_type: res.headers.get('content-type') || 'text/plain' };
}

function stripHtml(str) {
  if (!str) return '';
  return str.replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim();
}

function drawChart(canvas, config) {
  const ctx = canvas.getContext('2d');
  const { type, title, labels, datasets } = config;
  const w = canvas.width;
  const h = canvas.height;
  const pad = { top: 28, bottom: 36, left: 44, right: 12 };
  const colors = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16'];
  const textColor = '#a1a1aa';
  const axisColor = 'rgba(255,255,255,0.12)';
  function getColor(i) { return colors[i % colors.length]; }

  ctx.clearRect(0, 0, w, h);

  if (title) {
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(title, w / 2, 4);
  }

  if (!labels || labels.length === 0) {
    ctx.fillStyle = textColor;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data', w / 2, h / 2);
    return;
  }

  if (type === 'pie') {
    const cx = w / 2;
    const cy = h / 2 + 6;
    const radius = Math.min(w / 2 - 28, h / 2 - 34);
    const dataset = datasets && datasets[0] ? datasets[0].data : [];
    const total = dataset.reduce(function (s, v) { return s + v; }, 0);
    if (total === 0) {
      ctx.fillStyle = textColor;
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No data', cx, cy);
      return;
    }
    var startAngle = -Math.PI / 2;
    dataset.forEach(function (val, i) {
      if (val <= 0) return;
      var sliceAngle = (val / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = getColor(i);
      ctx.fill();
      if (sliceAngle > 0.25) {
        var midAngle = startAngle + sliceAngle / 2;
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(Math.round(val / total * 100) + '%', cx + Math.cos(midAngle) * (radius * 0.6), cy + Math.sin(midAngle) * (radius * 0.6));
      }
      startAngle += sliceAngle;
    });
    return;
  }

  var left = pad.left;
  var right = w - pad.right;
  var top = pad.top + 4;
  var bottom = h - pad.bottom;
  var cw = right - left;
  var ch = bottom - top;

  ctx.strokeStyle = axisColor;
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left, bottom);
  ctx.stroke();

  var maxVal = 0;
  datasets.forEach(function (ds) {
    ds.data.forEach(function (v) {
      if (v > maxVal) maxVal = v;
    });
  });
  if (maxVal === 0) maxVal = 1;
  maxVal = Math.ceil(maxVal * 1.1);

  ctx.fillStyle = textColor;
  ctx.font = '8px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  var ySteps = 4;
  for (var i = 0; i <= ySteps; i++) {
    var val = (maxVal / ySteps) * i;
    var y = bottom - (val / maxVal) * ch;
    ctx.fillText(Math.round(val), left - 3, y);
    ctx.strokeStyle = axisColor;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
  }

  if (type === 'bar') {
    var n = labels.length;
    var groupW = cw / n;
    var barW = groupW * 0.6;
    var gapW = groupW * 0.4;
    var dsCount = datasets.length;
    var itemW = barW / dsCount;
    labels.forEach(function (label, i) {
      var groupX = left + i * groupW;
      ctx.fillStyle = textColor;
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(label, groupX + groupW / 2, bottom + 4);
      datasets.forEach(function (ds, j) {
        var val = ds.data[i] || 0;
        var barH = (val / maxVal) * ch;
        var x = groupX + gapW / 2 + j * (itemW + 1);
        ctx.fillStyle = ds.color || getColor(j);
        ctx.fillRect(x, bottom - barH, itemW, barH);
      });
    });
  } else if (type === 'line') {
    var n = labels.length;
    var stepX = n > 1 ? cw / (n - 1) : 0;
    datasets.forEach(function (ds, j) {
      ctx.strokeStyle = ds.color || getColor(j);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ds.data.forEach(function (val, i) {
        var x = left + i * stepX;
        var y = bottom - (val / maxVal) * ch;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });
    labels.forEach(function (label, i) {
      ctx.fillStyle = textColor;
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(label, left + i * stepX, bottom + 4);
      datasets.forEach(function (ds, j) {
        var val = ds.data[i] || 0;
        var x = left + i * stepX;
        var y = bottom - (val / maxVal) * ch;
        ctx.fillStyle = ds.color || getColor(j);
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, 2 * Math.PI);
        ctx.fill();
      });
    });
  }
}
