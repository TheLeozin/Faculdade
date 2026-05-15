/**
 * SmartBiz Connect – script.js
 * Lógica principal: validação, requisição ao webhook e exibição da resposta da IA.
 */

// ============================================================
// CONFIGURAÇÃO
// ============================================================

/**
 * Cole aqui a URL do seu webhook do Make.
 * Ex: "https://hook.eu1.make.com/xxxxxxxxxxxxxxxx"
 */
const WEBHOOK_URL = "https://hook.us2.make.com/jn38305xuox5kfxnq9xfr8cd1s4kno5e";

// ============================================================
// REFERÊNCIAS AOS ELEMENTOS DO DOM
// ============================================================

const form       = document.getElementById("smartbiz-form");
const submitBtn  = document.getElementById("submit-btn");
const btnContent = document.getElementById("btn-content");
const btnLoading = document.getElementById("btn-loading");

const resultArea  = document.getElementById("result-area");
const resultCards = document.getElementById("result-cards");
const mainLayout  = document.getElementById("main-layout");

const errorArea    = document.getElementById("error-area");
const errorMessage = document.getElementById("error-message");
const retryBtn     = document.getElementById("retry-btn");

// ============================================================
// METADADOS DOS 5 CARDS (ordem = ordem da resposta da IA)
// ============================================================

const CARD_META = [
  { icon: "award",          color: "#3b82f6", label: "Slogan" },
  { icon: "file-text",      color: "#8b5cf6", label: "Descrição" },
  { icon: "instagram",      color: "#ec4899", label: "Bio Instagram" },
  { icon: "percent",        color: "#f59e0b", label: "Mensagem Promocional" },
  { icon: "message-circle", color: "#10b981", label: "WhatsApp" },
];

// ============================================================
// UTILITÁRIOS DE TEXTO
// ============================================================

/**
 * Converte markdown simples (**texto**) para HTML (<strong>texto</strong>).
 * Preserva quebras de linha como <br>.
 */
function markdownToHtml(text) {
  return text
    .replace(/###\s+(.+)/g, "<strong>$1</strong>")   // ### Título → bold
    .replace(/##\s+(.+)/g,  "<strong>$1</strong>")   // ## Título → bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>") // **texto** → bold
    .replace(/\n/g, "<br>");
}

/**
 * Divide a resposta da IA nos 5 itens numerados.
 * Extrai o título (dentro de **) e o conteúdo de cada item.
 * @param {string} text
 * @returns {Array<{title: string, content: string}>}
 */
function parseIAResponse(text) {
  const items = [];

  // ── Formato 1: "### N. Título" (Markdown headers) ──────────────────────────
  // Ex: "### 1. Slogan Curto\nconteúdo\n\n### 2. ..."
  let regex = /###\s+\d+[\.\)]\s+([^\n]+)\n([\s\S]*?)(?=\n###\s+\d+[\.\)]|\s*$)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const content = match[2].trim();
    if (content) items.push({ title: match[1].trim(), content });
  }
  if (items.length >= 2) return items;

  // ── Formato 2: "N. **Título:**" (bold headers) ─────────────────────────────
  // Ex: "1. **Slogan curto:**\nconteúdo\n\n2. **Descrição...**"
  items.length = 0;
  regex = /\d+[\.\)]\s+\*\*([^*]+)\*\*[:\s]*([\s\S]*?)(?=\n\s*\d+[\.\)]\s+\*\*|\s*$)/g;
  while ((match = regex.exec(text)) !== null) {
    const content = match[2].trim();
    if (content) items.push({ title: match[1].trim().replace(/:$/, ""), content });
  }
  if (items.length >= 2) return items;

  // ── Formato 3: "**N. Título**" (bold com número dentro) ───────────────────
  items.length = 0;
  regex = /\*\*\d+[\.\)]\s+([^*]+)\*\*[:\s]*([\s\S]*?)(?=\n\s*\*\*\d+[\.\)]|\s*$)/g;
  while ((match = regex.exec(text)) !== null) {
    const content = match[2].trim();
    if (content) items.push({ title: match[1].trim(), content });
  }
  if (items.length >= 2) return items;

  // ── Fallback genérico: divide por qualquer linha numerada ─────────────────
  items.length = 0;
  const chunks = text.split(/\n(?=\d+[\.\)]\s)/);
  chunks.forEach((chunk, i) => {
    const clean = chunk.replace(/^\d+[\.\)]\s*/, "").trim();
    if (clean) items.push({ title: CARD_META[i]?.label || `Item ${i + 1}`, content: clean });
  });

  return items;
}

/**
 * Gera o HTML de um card de resultado.
 * @param {string} title     – Título extraído da resposta (ou do CARD_META)
 * @param {string} content   – Conteúdo textual do item
 * @param {number} index     – Índice 0-4
 * @returns {HTMLElement}
 */
function createResultCard(title, content, index) {
  const meta = CARD_META[index] || { icon: "file-text", color: "#3b82f6", label: title };

  const card = document.createElement("div");
  card.className = "result-card";
  card.setAttribute("role", "listitem");
  card.style.setProperty("--card-accent", meta.color);

  card.innerHTML = `
    <div class="result-card-header">
      <span class="result-card-icon" aria-hidden="true">
        <i data-feather="${meta.icon}"></i>
      </span>
      <h4 class="result-card-title">${title || meta.label}</h4>
      <button class="btn-copy-card" data-content="${encodeURIComponent(content)}" aria-label="Copiar ${title || meta.label}">
        <i data-feather="copy"></i>
        Copiar
      </button>
    </div>
    <div class="result-card-body">${markdownToHtml(content)}</div>
  `;

  return card;
}

// ============================================================
// DROPDOWN CUSTOMIZADO – Tom da comunicação
// ============================================================

(function initCustomSelect() {
  const container  = document.getElementById("tom-custom");
  const display    = document.getElementById("tom-display");
  const optionList = document.getElementById("tom-options");
  const hiddenInput = document.getElementById("tom");
  const options    = optionList.querySelectorAll(".custom-select-option");

  function openDropdown() {
    optionList.hidden = false;
    container.classList.add("is-open");
    container.setAttribute("aria-expanded", "true");
  }

  function closeDropdown() {
    optionList.hidden = true;
    container.classList.remove("is-open");
    container.setAttribute("aria-expanded", "false");
  }

  function selectOption(value, label) {
    hiddenInput.value = value;
    display.textContent = label;
    display.classList.remove("custom-select-placeholder");

    // Marca a opção ativa
    options.forEach(opt => opt.classList.toggle("is-selected", opt.dataset.value === value));

    // Remove estado de erro se houver
    container.classList.remove("input-error");
    const errorEl = document.getElementById("tom-error");
    if (errorEl) errorEl.textContent = "";

    closeDropdown();
    container.focus();
  }

  // Abre/fecha ao clicar no trigger
  container.addEventListener("click", (e) => {
    e.stopPropagation();
    container.classList.contains("is-open") ? closeDropdown() : openDropdown();
  });

  // Seleciona opção ao clicar
  options.forEach((opt) => {
    opt.addEventListener("click", (e) => {
      e.stopPropagation();
      selectOption(opt.dataset.value, opt.textContent.trim());
    });
    // Suporte a teclado nas opções
    opt.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectOption(opt.dataset.value, opt.textContent.trim());
      }
    });
  });

  // Navegação por teclado no container
  container.addEventListener("keydown", (e) => {
    const isOpen = container.classList.contains("is-open");
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      isOpen ? closeDropdown() : openDropdown();
    } else if (e.key === "Escape") {
      closeDropdown();
    } else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && isOpen) {
      e.preventDefault();
      const all = [...options];
      const current = all.findIndex(o => o.classList.contains("is-selected"));
      let next = e.key === "ArrowDown"
        ? Math.min(current + 1, all.length - 1)
        : Math.max(current - 1, 0);
      if (current === -1) next = e.key === "ArrowDown" ? 0 : all.length - 1;
      selectOption(all[next].dataset.value, all[next].textContent.trim());
    }
  });

  // Fecha ao clicar fora
  document.addEventListener("click", () => closeDropdown());
})();

// ============================================================
// GERENCIAMENTO DE ESTADO DA UI
// ============================================================

/**
 * Ativa ou desativa o estado de carregamento no botão.
 * @param {boolean} loading
 */
function setLoading(loading) {
  submitBtn.disabled = loading;
  btnContent.style.display = loading ? "none"   : "flex";
  btnLoading.style.display = loading ? "flex"   : "none";
  btnLoading.setAttribute("aria-hidden", String(!loading));
}

/**
 * Exibe a área de resultado com animação fade-in.
 * @param {string} text – Texto retornado pela IA.
 */
function showResult(text) {
  hideError();

  // Limpa cards anteriores
  resultCards.innerHTML = "";

  // Faz o parse dos 5 itens
  const items = parseIAResponse(text);

  // Renderiza um card por item
  items.forEach((item, i) => {
    const card = createResultCard(item.title, item.content, i);
    resultCards.appendChild(card);
  });

  // Ativa os ícones Feather nos cards recém-criados
  if (typeof feather !== "undefined") feather.replace();

  // Ativa layout de 2 colunas
  mainLayout.classList.add("has-results");
  resultArea.hidden = false;

  requestAnimationFrame(() => {
    resultArea.style.animation = "none";
    requestAnimationFrame(() => { resultArea.style.animation = ""; });
  });

  // Scroll até os cards no mobile (no desktop já estão visíveis ao lado)
  if (window.innerWidth <= 768) {
    resultArea.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

/**
 * Exibe a área de erro com uma mensagem amigável.
 * @param {string} msg – Mensagem de erro para o usuário.
 */
function showError(msg) {
  hideResult();
  errorMessage.textContent = msg;
  errorArea.hidden = false;

  requestAnimationFrame(() => {
    errorArea.style.animation = "none";
    requestAnimationFrame(() => {
      errorArea.style.animation = "";
    });
  });

  errorArea.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function hideResult() {
  mainLayout.classList.remove("has-results");
  resultArea.hidden = true;
}
function hideError()  { errorArea.hidden  = true; }

// ============================================================
// VALIDAÇÃO DO FORMULÁRIO
// ============================================================

/**
 * Limpa todos os erros inline dos campos.
 */
function clearFieldErrors() {
  form.querySelectorAll(".form-input").forEach(el => el.classList.remove("input-error"));
  form.querySelectorAll(".field-error").forEach(el => (el.textContent = ""));
  // Limpa também o estado de erro do dropdown custom
  const customSelect = document.getElementById("tom-custom");
  if (customSelect) customSelect.classList.remove("input-error");
}

/**
 * Exibe erro em um campo específico.
 * @param {string} fieldId  – id do <input> / <select> / <textarea>
 * @param {string} message  – Mensagem de erro.
 */
function setFieldError(fieldId, message) {
  const errorEl = document.getElementById(`${fieldId}-error`);
  if (errorEl) errorEl.textContent = message;

  // O campo "tom" usa dropdown custom – marca o container, não o hidden input
  if (fieldId === "tom") {
    const customSelect = document.getElementById("tom-custom");
    if (customSelect) customSelect.classList.add("input-error");
  } else {
    const field = document.getElementById(fieldId);
    if (field) field.classList.add("input-error");
  }
}

/**
 * Valida todos os campos do formulário.
 * @returns {{ valid: boolean, data: object|null }}
 */
function validateForm() {
  clearFieldErrors();

  const nome     = form.nome.value.trim();
  const tipo     = form.tipo.value.trim();
  const objetivo = form.objetivo.value.trim();
  const tom      = form.tom.value;

  let valid = true;

  if (!nome) {
    setFieldError("nome", "Por favor, informe o nome da empresa.");
    valid = false;
  }

  if (!tipo) {
    setFieldError("tipo", "Por favor, informe o tipo de negócio.");
    valid = false;
  }

  if (!objetivo) {
    setFieldError("objetivo", "Por favor, descreva o objetivo da empresa.");
    valid = false;
  }

  if (!tom) {
    setFieldError("tom", "Por favor, selecione o tom de comunicação.");
    valid = false;
  }

  if (!valid) return { valid: false, data: null };

  return { valid: true, data: { nome, tipo, objetivo, tom } };
}

// ============================================================
// CHAMADA AO WEBHOOK
// ============================================================

/**
 * Envia os dados para o webhook do Make e retorna o texto da resposta.
 * @param {{ nome: string, tipo: string, objetivo: string, tom: string }} payload
 * @returns {Promise<string>}
 */
async function callWebhook(payload) {
  // Verifica se o usuário configurou a URL
  if (!WEBHOOK_URL || WEBHOOK_URL === "COLE_AQUI_O_WEBHOOK") {
    throw new Error(
      "Webhook não configurado. Abra o arquivo script.js e substitua " +
      '"COLE_AQUI_O_WEBHOOK" pela URL do seu webhook do Make.'
    );
  }

  const response = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      nome:     payload.nome,
      tipo:     payload.tipo,
      objetivo: payload.objetivo,
      tom:      payload.tom
    }),
  });

  if (!response.ok) {
    throw new Error(
      `O servidor respondeu com o status ${response.status} – ${response.statusText}. ` +
      "Verifique se o webhook está ativo e tente novamente."
    );
  }

  // Tenta ler como JSON primeiro; se falhar, lê como texto puro
  let text;
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const json = await response.json();

    // Extrai o texto da resposta tratando estruturas comuns do Make/OpenAI
    text =
      json?.output           ||   // campo genérico "output"
      json?.result           ||   // campo genérico "result"
      json?.content          ||   // campo genérico "content"
      json?.message          ||   // campo genérico "message"
      json?.choices?.[0]?.message?.content || // OpenAI Chat Completion
      JSON.stringify(json, null, 2);           // fallback: exibe o JSON formatado
  } else {
    text = await response.text();
  }

  if (!text || text.trim() === "") {
    throw new Error("A IA retornou uma resposta vazia. Tente novamente.");
  }

  return text.trim();
}

// ============================================================
// HANDLER PRINCIPAL – SUBMIT DO FORMULÁRIO
// ============================================================

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  // Limpa resultados anteriores
  hideResult();
  hideError();

  // Valida campos
  const { valid, data } = validateForm();
  if (!valid) return;

  // Inicia loading
  setLoading(true);

  try {
    const iaText = await callWebhook(data);
    showResult(iaText);
  } catch (err) {
    console.error("[SmartBiz Connect] Erro ao chamar webhook:", err);
    showError(err.message || "Ocorreu um erro inesperado. Por favor, tente novamente.");
  } finally {
    setLoading(false);
  }
});

// ============================================================
// COPIAR CONTEÚDO POR CARD (delegação de evento)
// ============================================================

resultCards.addEventListener("click", async (e) => {
  const btn = e.target.closest(".btn-copy-card");
  if (!btn) return;

  const text = decodeURIComponent(btn.dataset.content || "");
  if (!text) return;

  async function doCopy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback legacy
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;opacity:0;pointer-events:none;";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  }

  await doCopy();

  // Feedback visual
  btn.classList.add("copied");
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
    Copiado!
  `;

  setTimeout(() => {
    btn.classList.remove("copied");
    btn.innerHTML = `<i data-feather="copy"></i> Copiar`;
    if (typeof feather !== "undefined") feather.replace();
  }, 2200);
});

// ============================================================
// BOTÃO "TENTAR NOVAMENTE"
// ============================================================

retryBtn.addEventListener("click", () => {
  hideError();
  // Coloca o foco no primeiro campo para facilitar a correção
  form.nome.focus();
});

// ============================================================
// REMOVER ERRO DO CAMPO QUANDO O USUÁRIO COMEÇA A DIGITAR
// ============================================================

form.querySelectorAll(".form-input").forEach((input) => {
  const eventType = input.tagName === "SELECT" ? "change" : "input";

  input.addEventListener(eventType, () => {
    if (input.classList.contains("input-error")) {
      input.classList.remove("input-error");
      const errorEl = document.getElementById(`${input.id}-error`);
      if (errorEl) errorEl.textContent = "";
    }
  });
});
