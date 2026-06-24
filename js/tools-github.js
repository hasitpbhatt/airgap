async function handleGitHubGetContents(args) {
  if (!githubToken) return { error: 'GitHub token not configured. Add one in Settings.' };
  try {
    var ghUrl = 'https://api.github.com/repos/' + args.owner + '/' + args.repo + '/contents/' + encodeURIComponent(args.path);
    if (args.ref) ghUrl += '?ref=' + encodeURIComponent(args.ref);
    var ghRes = await fetch(ghUrl, { headers: { Authorization: 'Bearer ' + githubToken } });
    var ghData = await ghRes.json();
    if (!ghRes.ok) return { error: ghData.message || 'HTTP ' + ghRes.status };
    var ghContent = '';
    if (ghData.type === 'file' && ghData.content) {
      ghContent = decodeURIComponent(escape(atob(ghData.content)));
    }
    if (ghContent && (args.offset || args.limit)) {
      var ghOffset = Math.max(0, args.offset || 0);
      var ghTotal = ghContent.length;
      ghContent = ghContent.slice(ghOffset, args.limit > 0 ? ghOffset + args.limit : undefined);
    }
    var ghResult = { sha: ghData.sha, content: ghContent, size: ghData.size, encoding: ghData.encoding, html_url: ghData.html_url, path: ghData.path, type: ghData.type, name: ghData.name };
    if (ghContent && (args.offset || args.limit)) {
      ghResult.range = { offset: ghOffset, count: ghContent.length, total: ghTotal };
    }
    return ghResult;
  } catch (err) {
    console.warn('GitHub GET contents failed, returning error object', err);
    return { error: err.message };
  }
}

async function handleGitHubCreateOrUpdateFile(args) {
  if (!githubToken) return { error: 'GitHub token not configured. Add one in Settings.' };
  try {
    var ghUrl = 'https://api.github.com/repos/' + args.owner + '/' + args.repo + '/contents/' + encodeURIComponent(args.path);
    var ghBody = { message: args.message, content: btoa(unescape(encodeURIComponent(args.content))), branch: args.branch };
    if (args.sha) ghBody.sha = args.sha;
    var ghRes = await fetch(ghUrl, {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + githubToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(ghBody)
    });
    var ghData = await ghRes.json();
    if (!ghRes.ok) return { error: ghData.message || 'HTTP ' + ghRes.status };
    return { content: { html_url: ghData.content.html_url }, commit: { sha: ghData.commit.sha, html_url: ghData.commit.html_url } };
  } catch (err) {
    console.warn('GitHub create/update file failed, returning error object', err);
    return { error: err.message };
  }
}

async function handleGitHubCreatePr(args) {
  if (!githubToken) return { error: 'GitHub token not configured. Add one in Settings.' };
  try {
    var ghUrl = 'https://api.github.com/repos/' + args.owner + '/' + args.repo + '/pulls';
    var ghBody = { title: args.title, head: args.head, base: args.base };
    if (args.body) ghBody.body = args.body;
    if (args.draft) ghBody.draft = true;
    var ghRes = await fetch(ghUrl, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + githubToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(ghBody)
    });
    var ghData = await ghRes.json();
    if (!ghRes.ok) return { error: ghData.message || 'HTTP ' + ghRes.status };
    return { html_url: ghData.html_url, number: ghData.number, state: ghData.state, title: ghData.title };
  } catch (err) {
    return { error: err.message };
  }
}

async function handleGitHubCreateIssue(args) {
  if (!githubToken) return { error: 'GitHub token not configured. Add one in Settings.' };
  try {
    var ghUrl = 'https://api.github.com/repos/' + args.owner + '/' + args.repo + '/issues';
    var ghBody = { title: args.title };
    if (args.body) ghBody.body = args.body;
    if (args.labels) ghBody.labels = args.labels;
    if (args.assignees) ghBody.assignees = args.assignees;
    var ghRes = await fetch(ghUrl, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + githubToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(ghBody)
    });
    var ghData = await ghRes.json();
    if (!ghRes.ok) return { error: ghData.message || 'HTTP ' + ghRes.status };
    return { html_url: ghData.html_url, number: ghData.number, state: ghData.state, title: ghData.title };
  } catch (err) {
    return { error: err.message };
  }
}
