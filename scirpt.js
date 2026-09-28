const config = window.JMP_SUPABASE_CONFIG;
const client = window.supabase && config ? window.supabase.createClient(config.url, config.publishableKey) : null;
const bucket = 'jmp-catalog';
const state = { files: [], company: '', query: '', view: 'grid', category: 'all', audience: 'customers', isAdmin: false };
const companyLinks = {
	'COMPENSADO JFEY': 'https://jmp-compensados-c93c9c.netlify.app/',
	'COMPENSADO NORTE SUL': 'https://jpm-colabranca-915a0b.netlify.app/'
};
const $ = (selector) => document.querySelector(selector);

function isAdminEmail(email) { return config.adminEmails.some((adminEmail) => adminEmail.toLowerCase() === String(email || '').toLowerCase()); }
function adminEmailsLabel() { return config.adminEmails.join(' ou '); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]); }
function formatSize(bytes) { if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`; return `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }
function normalizeName(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
function displayName(file) { return normalizeName(file.name); }
function companyOf(file) { return (file.folder || 'COMPENSADO JFEY').split('/')[0]; }
function companyLabel(company) {
	const normalized = company.trim();
	if (normalized.toUpperCase() === 'HIBRA PORTAS') return 'HIBRA PORTAS';
	return normalized.replace(/^TABELA\s+/i, '').replace(/^COMPENSADO\s+/i, '').replace(/^MAD\.\s*/i, 'MAD. ');
}
function is2026(file) { return /2026/i.test(`${file.name} ${file.folder}`); }
function isFolder(file) { return /fold(?:er|en)/i.test(`${file.name} ${file.folder}`); }
function setStatus(message, isError = false) {
	const status = $('#admin-status');
	if (!status) return;
	status.textContent = message;
	status.classList.toggle('is-error', isError);
}

async function listStorageFiles(prefix) {
	const { data, error } = await client.storage.from(bucket).list(prefix, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
	if (error) throw error;
	const files = [];
	for (const item of data || []) {
		const path = `${prefix}/${item.name}`;
		if (item.id) files.push({ ...item, path });
		else files.push(...await listStorageFiles(path));
	}
	return files;
}

async function loadFiles() {
	const data = await listStorageFiles('catalog');
	state.files = data.filter((item) => item.name.toLowerCase().endsWith('.pdf')).map((item) => {
		const metadata = item.metadata || {};
		const storageFolder = item.path.split('/').slice(1, -1).join('/');
		return {
			name: metadata.catalog_name || item.name.replace(/^[0-9a-f-]+-/i, '').replace(/\.pdf$/i, ''),
			folder: metadata.catalog_folder || storageFolder,
			path: item.path,
			size: Number(metadata.size || 0),
			url: client.storage.from(bucket).getPublicUrl(item.path).data.publicUrl
		};
	});
}

function renderFolders() {
	const companies = [...new Set(state.files.map(companyOf))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
	const allButton = `<button class="folder-button all-companies-button ${state.company ? '' : 'selected'}" data-company="" type="button"><span class="folder-symbol" aria-hidden="true">◆</span><span>Todas as empresas</span><b>${state.files.length}</b></button>`;
	$('#folder-list').innerHTML = allButton + companies.map((company) => {
		const count = state.files.filter((file) => companyOf(file) === company).length;
		const hasLink = !!companyLinks[company];
		const encodedCompany = encodeURIComponent(company);
		return `<button class="folder-button ${state.company === company ? 'selected' : ''}" data-company="${encodedCompany}" type="button"><span class="folder-symbol" aria-hidden="true">□</span><span>${escapeHtml(companyLabel(company))}</span><b>${count}</b>${hasLink ? `<span class="company-site-badge" data-company="${encodedCompany}" aria-label="Abrir site da empresa">↗</span>` : ''}</button>`;
	}).join('');
	document.querySelectorAll('.folder-button').forEach((button) => button.addEventListener('click', (event) => {
		const badge = event.target.closest('.company-site-badge');
		if (badge) {
			const company = decodeURIComponent(badge.dataset.company);
			if (companyLinks[company]) window.open(companyLinks[company], '_blank', 'noopener,noreferrer');
			return;
		}
		state.company = decodeURIComponent(button.dataset.company);
		renderFolders();
		render();
	}));
}

$('#clear-company').addEventListener('click', () => {
	state.company = '';
	renderFolders();
	render();
});

function filteredFiles() {
	const query = state.query.toLocaleLowerCase('pt-BR');
	let files = state.files.filter((file) => {
		const haystack = `${file.name} ${file.folder}`.toLocaleLowerCase('pt-BR');
		return (!state.company || companyOf(file) === state.company) && (!query || haystack.includes(query));
	});
	if (state.company === 'HIBRA PORTAS') {
		const allowedNames = new Set(['TABELA DE PREÇO HIBRA PORTAS 2', 'TABELA  DE PREÇO HIBRA PORTAS  2'].map(normalizeName));
		files = files.filter((file) => allowedNames.has(normalizeName(displayName(file))));
	}
	return files;
}

function card(file) {
	const name = escapeHtml(displayName(file));
	const company = companyOf(file);
	const location = escapeHtml((file.folder || company).replace(`${company}/`, '') || company);
	return `<article class="file-card"><a class="file-preview" href="${escapeHtml(file.url)}" target="_blank" rel="noopener"><span class="file-glyph pdf">PDF</span><span class="open-indicator" aria-hidden="true">↗</span></a><div class="file-info"><div class="file-meta"><span>PDF</span><span>${formatSize(file.size)}</span></div><h3 title="${name}">${name}</h3><p>${location}</p></div></article>`;
}

function render() {
	const files = filteredFiles();
	$('#catalog').className = `catalog-grid ${state.view === 'list' ? 'list-view' : ''}`;
	$('#catalog').innerHTML = files.map(card).join('');
	$('#empty-state').hidden = files.length > 0;
	$('#empty-state h3').textContent = state.files.length ? 'Nada encontrado' : 'Catálogo em preparação';
	$('#empty-state p').textContent = state.files.length ? 'Tente outro termo ou escolha outra empresa.' : 'Os PDFs aparecerão aqui depois da importação inicial.';
	$('#result-count').textContent = `${files.length} PDF${files.length === 1 ? '' : 's'}`;
	$('#view-title').textContent = state.company ? state.company : 'Todas as empresas';
	document.querySelectorAll('.view-button').forEach((button) => button.classList.toggle('active', button.dataset.view === state.view));
}

function renderManager() {
	const managerList = $('#manager-list');
	if (!managerList) return;
	$('#manager-count').textContent = `${state.files.length} PDF${state.files.length === 1 ? '' : 's'}`;
	managerList.innerHTML = state.files.length ? state.files.map((file) => `<article class="manager-row"><div><strong>${escapeHtml(displayName(file))}</strong><span>${escapeHtml(file.folder || 'Sem pasta')} · ${formatSize(file.size)}</span></div><button class="delete-file-button" type="button" data-path="${escapeHtml(file.path)}" aria-label="Excluir ${escapeHtml(displayName(file))}">Excluir</button></article>`).join('') : '<p class="manager-empty">Nenhum PDF publicado ainda.</p>';
}

async function refreshCatalog() {
	await loadFiles();
	renderFolders();
	render();
	renderManager();
}

function setAudience(audience) {
	state.audience = audience;
	$('#customer-view').hidden = audience !== 'customers';
	$('#admin-view').hidden = audience !== 'admin';
	document.querySelectorAll('.audience-tab').forEach((button) => {
		const active = button.dataset.audience === audience;
		button.classList.toggle('active', active);
		button.setAttribute('aria-selected', String(active));
	});
}

function setAdminSession(user) {
	state.isAdmin = Boolean(user && isAdminEmail(user.email));
	$('#admin-login').hidden = state.isAdmin;
	$('#admin-workspace').hidden = !state.isAdmin;
	$('#admin-identity').textContent = state.isAdmin ? user.email : '';
}

async function handleLogin(event) {
	event.preventDefault();
	const email = $('#admin-email').value.trim().toLowerCase();
	const password = $('#admin-password').value;
	if (!isAdminEmail(email)) {
		setStatus(`Use um dos e-mails autorizados: ${adminEmailsLabel()}.`, true);
		return;
	}
	setStatus('');
	const result = await client.auth.signInWithPassword({ email, password });
	if (result.error) {
		const needsFirstAccess = /invalid login credentials/i.test(result.error.message);
		const emailNotConfirmed = /email not confirmed/i.test(result.error.message);
		let message = result.error.message;
		if (emailNotConfirmed) {
			message = 'Este usuário ainda exige confirmação por e-mail. Crie ou confirme o usuário no painel do Supabase com confirmação automática.';
		} else if (needsFirstAccess) {
			message = 'E-mail ou senha inválidos. O usuário precisa ser criado no painel do Supabase.';
		}
		setStatus(message, true);
		return;
	}
	if (!result.data.session) {
		setStatus(`Confira a caixa de entrada de ${email} e confirme o acesso pelo link enviado. Depois volte e clique em Entrar.`);
		return;
	}
	await finishAdminLogin(result.data.session.user);
}

async function finishAdminLogin(user) {
	if (!user || !isAdminEmail(user.email)) {
		await client.auth.signOut();
		setAdminSession(null);
		setStatus(`A conta conectada não corresponde aos e-mails autorizados: ${adminEmailsLabel()}.`, true);
		return;
	}
	setAdminSession(user);
	setStatus('');
	try {
		await refreshCatalog();
	} catch (error) {
		setStatus(`Não foi possível carregar os arquivos: ${error.message}`, true);
	}
}

async function addFiles(event) {
	event.preventDefault();
	const files = [...$('#upload-files').files];
	const folder = $('#upload-folder').value.trim();
	if (!files.length) return;
	if (!folder) {
		setStatus('Informe o nome da empresa ou pasta antes de enviar os PDFs.', true);
		return;
	}
	if (files.some((file) => file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf'))) {
		setStatus('Selecione somente arquivos PDF.', true);
		return;
	}
	const safeFolder = folder.split('/').map((segment) => segment.trim().normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-')).filter(Boolean).join('/');
	const storage = client.storage.from(bucket);
	let added = 0;
	for (const file of files) {
		const safeName = file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-');
		const path = `catalog/${safeFolder}/${crypto.randomUUID()}-${safeName}`;
		const { error } = await storage.upload(path, file, {
			contentType: 'application/pdf',
			upsert: false,
			metadata: { catalog_name: file.name.replace(/\.pdf$/i, ''), catalog_folder: folder }
		});
		if (error) {
			setStatus(`Falha ao enviar ${file.name}: ${error.message}`, true);
			await refreshCatalog();
			return;
		}
		added += 1;
	}
	$('#upload-form').reset();
	await refreshCatalog();
	setStatus(`${added} arquivo${added === 1 ? '' : 's'} adicionado${added === 1 ? '' : 's'}.`);
}

async function deleteFile(path) {
	const file = state.files.find((item) => item.path === path);
	if (!file || !window.confirm(`Excluir "${displayName(file)}" permanentemente?`)) return;
	setStatus('Excluindo arquivo...');
	const { error } = await client.storage.from(bucket).remove([path]);
	if (error) {
		setStatus(`Não foi possível excluir: ${error.message}`, true);
		return;
	}
	await refreshCatalog();
	setStatus('Arquivo excluído permanentemente do catálogo.');
}

async function importLegacyCatalog() {
	if (!window.confirm('Importar os PDFs do catálogo atual para o Supabase? Os arquivos existentes serão mantidos até a migração terminar.')) return;
	const button = $('#import-legacy');
	button.disabled = true;
	try {
		const response = await fetch('docs-index.json');
		if (!response.ok) throw new Error('Não foi possível ler docs-index.json.');
		const entries = (await response.json()).filter((file) => file.kind === 'pdf');
		const { data: existing, error: listError } = await client.storage.from(bucket).list('catalog', { limit: 1000 });
		if (listError) throw listError;
		const existingNames = new Set((existing || []).map((item) => item.name));
		let imported = 0;
		let skipped = 0;
		for (let index = 0; index < entries.length; index += 1) {
			const entry = entries[index];
			const legacyName = `legado-${encodeURIComponent(entry.path.replace(/^docs\//, ''))}`;
			if (existingNames.has(legacyName)) { skipped += 1; continue; }
			setStatus(`Importando PDFs: ${index + 1} de ${entries.length}...`);
			const fileResponse = await fetch(entry.path);
			if (!fileResponse.ok) throw new Error(`Não foi possível ler ${entry.path}.`);
			const fileBlob = await fileResponse.blob();
			const { error } = await client.storage.from(bucket).upload(`catalog/${legacyName}`, fileBlob, {
				contentType: 'application/pdf',
				upsert: false,
				metadata: { catalog_name: entry.name, catalog_folder: entry.folder, source_path: entry.path }
			});
			if (error) throw new Error(`${entry.name}: ${error.message}`);
			existingNames.add(legacyName);
			imported += 1;
		}
		await refreshCatalog();
		setStatus(`Migração concluída: ${imported} importados, ${skipped} já existentes.`);
	} catch (error) {
		setStatus(`A migração parou: ${error.message}`, true);
		await refreshCatalog();
	} finally {
		button.disabled = false;
	}
}

async function init() {
	if (!client) {
		$('#catalog').innerHTML = '<div class="load-error"><h3>Catálogo não configurado</h3><p>Configure a conexão do Supabase para carregar os arquivos.</p></div>';
		return;
	}
	$('#admin-email').placeholder = 'E-mail autorizado';
	try {
		const { data, error } = await client.auth.getSession();
		if (error) throw error;
		setAdminSession(data.session?.user || null);
		await refreshCatalog();
		const companies = [...new Set(state.files.map(companyOf))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
		state.company = companies.includes('HIBRA PORTAS') ? 'HIBRA PORTAS' : (companies[0] || '');
		renderFolders();
		render();
	} catch (error) {
		$('#catalog').innerHTML = `<div class="load-error"><h3>Não foi possível carregar o catálogo</h3><p>${escapeHtml(error.message)}</p></div>`;
	}
}

$('#search').addEventListener('input', (event) => { state.query = event.target.value; render(); });
document.querySelectorAll('.view-button').forEach((button) => button.addEventListener('click', () => { state.view = button.dataset.view; render(); }));
document.querySelectorAll('.audience-tab').forEach((button) => button.addEventListener('click', () => setAudience(button.dataset.audience)));
$('#admin-login').addEventListener('submit', handleLogin);
$('#upload-form').addEventListener('submit', addFiles);
$('#admin-logout').addEventListener('click', async () => { await client.auth.signOut(); setAdminSession(null); setStatus(''); });
$('#import-legacy').addEventListener('click', importLegacyCatalog);
$('#manager-list').addEventListener('click', (event) => {
	const button = event.target.closest('.delete-file-button');
	if (button) deleteFile(button.dataset.path);
});
client?.auth.onAuthStateChange((_event, session) => setAdminSession(session?.user || null));
document.addEventListener('keydown', (event) => {
	if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); $('#search').focus(); }
});
init();
