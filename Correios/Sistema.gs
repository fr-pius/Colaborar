/**
 * Correios — diagnóstico inicial de identidade institucional.
 *
 * IMPORTANTE:
 * Este diagnóstico deve ser testado com a implantação configurada como:
 *   Executar como: usuário que acessa o app (USER_ACCESSING)
 *   Quem pode acessar: qualquer usuário do domínio (DOMAIN)
 *
 * Não passe o e-mail do usuário por parâmetros ou pelo navegador.
 * A identidade é obtida exclusivamente no servidor via Session.
 */

const CORREIOS_DOMINIO_INSTITUCIONAL = 'mosteirodasantacruz.org.br';

/**
 * Página temporária de diagnóstico para validar a identidade institucional.
 * Será substituída pela interface definitiva após os testes.
 */
function doGet() {
  const ativo = Session.getActiveUser().getEmail() || '';
  const efetivo = Session.getEffectiveUser().getEmail() || '';
  const dominioValido = ativo.toLowerCase().endsWith(
    '@' + CORREIOS_DOMINIO_INSTITUCIONAL
  );

  const estado = !ativo
    ? 'IDENTIDADE NÃO DISPONÍVEL'
    : dominioValido
      ? 'IDENTIDADE INSTITUCIONAL IDENTIFICADA'
      : 'ACESSO NEGADO';

  const cor = dominioValido ? '#23633d' : '#a12b2b';

  const html =
    '<!doctype html><html lang="pt-BR"><head>' +
    '<meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Correios · Diagnóstico</title>' +
    '<style>' +
    'body{font:16px system-ui,sans-serif;background:#f4f6f3;color:#24342a;' +
    'margin:0;padding:32px;}' +
    'main{max-width:620px;margin:8vh auto;background:white;padding:28px;' +
    'border:1px solid #dfe7df;border-radius:14px;}' +
    'h1{font-family:Georgia,serif;font-weight:400;}' +
    '.estado{font-weight:700;color:' + cor + ';}' +
    'dt{font-weight:700;margin-top:18px;}dd{margin:5px 0 0;overflow-wrap:anywhere;}' +
    'p{line-height:1.6;color:#65736a;}' +
    '</style></head><body><main>' +
    '<h1>Correios</h1>' +
    '<p>Teste de identificação da conta institucional.</p>' +
    '<p class="estado">' + estado + '</p>' +
    '<dl>' +
    '<dt>Usuário ativo</dt><dd>' + escaparHtml_(ativo || '(vazio)') + '</dd>' +
    '<dt>Usuário efetivo</dt><dd>' + escaparHtml_(efetivo || '(vazio)') + '</dd>' +
    '<dt>Domínio exigido</dt><dd>' +
    escaparHtml_(CORREIOS_DOMINIO_INSTITUCIONAL) + '</dd>' +
    '</dl>' +
    '<p>Esta página é apenas um teste. Nenhuma caixa de e-mail foi consultada.</p>' +
    '</main></body></html>';

  return HtmlService.createHtmlOutput(html)
    .setTitle('Correios · Diagnóstico de identidade')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Diagnóstico para execução manual no editor do Apps Script.
 * Não aceita identidade enviada pelo cliente.
 */
function diagnosticarIdentidadeInstitucional() {
  const ativo = Session.getActiveUser().getEmail() || '';
  const efetivo = Session.getEffectiveUser().getEmail() || '';

  const resultado = {
    usuarioAtivo: ativo || null,
    usuarioEfetivo: efetivo || null,
    dominioInstitucionalValido: Boolean(
      ativo.toLowerCase().endsWith(
        '@' + CORREIOS_DOMINIO_INSTITUCIONAL
      )
    ),
    dominioExigido: CORREIOS_DOMINIO_INSTITUCIONAL
  };

  Logger.log(JSON.stringify(resultado, null, 2));
  return resultado;
}

/**
 * Escapa valores exibidos na página de diagnóstico.
 */
function escaparHtml_(valor) {
  return String(valor).replace(/[&<>"']/g, function(caractere) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[caractere];
  });
}

const CORREIOS_CONFIG = {
  MAX_CONTAS: 3,
  PROVEDOR: 'Google',
  ESCOPOS: [
    'https://www.googleapis.com/auth/gmail.readonly'
  ],
  MENSAGENS_POR_PAGINA: 20
};

/**
 * Retorna a configuração básica do Correios.
 */
function obterConfiguracao() {
  return {
    nome: 'Correios',
    maxContas: CORREIOS_CONFIG.MAX_CONTAS,
    provedor: CORREIOS_CONFIG.PROVEDOR,
    escopos: CORREIOS_CONFIG.ESCOPOS
  };
}

/**
 * Verifica se o projeto está preparado.
 */
function verificarSistema() {
  const propriedades = PropertiesService.getScriptProperties();

  const clientId = propriedades.getProperty('GOOGLE_OAUTH_CLIENT_ID');
  const clientSecret = propriedades.getProperty('GOOGLE_OAUTH_CLIENT_SECRET');

  const resultado = {
    sistema: 'Correios',
    configurado: Boolean(clientId && clientSecret),
    bibliotecaOAuth: typeof OAuth2 !== 'undefined',
    limiteContas: CORREIOS_CONFIG.MAX_CONTAS
  };

  Logger.log(JSON.stringify(resultado, null, 2));
  return resultado;
}

/**
 * Cria o serviço OAuth de uma das três contas.
 */
function obterServicoGmail_(numeroConta) {
  validarNumeroConta_(numeroConta);

  const propriedades = PropertiesService.getScriptProperties();
  const clientId = propriedades.getProperty('GOOGLE_OAUTH_CLIENT_ID');
  const clientSecret = propriedades.getProperty('GOOGLE_OAUTH_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('As credenciais OAuth não estão configuradas.');
  }

  return OAuth2.createService('Correios_Gmail_' + numeroConta)
    .setAuthorizationBaseUrl('https://accounts.google.com/o/oauth2/v2/auth')
    .setTokenUrl('https://oauth2.googleapis.com/token')
    .setClientId(clientId)
    .setClientSecret(clientSecret)
    .setCallbackFunction('authCallbackGmail' + numeroConta)
    .setPropertyStore(PropertiesService.getUserProperties())
    .setCache(CacheService.getUserCache())
    .setLock(LockService.getUserLock())
    .setScope(CORREIOS_CONFIG.ESCOPOS.join(' '))
    .setParam('access_type', 'offline')
    .setParam('prompt', 'consent');
}

/**
 * Confere se o número da conta é válido.
 */
function validarNumeroConta_(numeroConta) {
  if (
    !Number.isInteger(numeroConta) ||
    numeroConta < 1 ||
    numeroConta > CORREIOS_CONFIG.MAX_CONTAS
  ) {
    throw new Error('Número de conta inválido. Utilize 1, 2 ou 3.');
  }
}

/**
 * Gera a URL de autorização de uma conta.
 */
function gerarUrlAutorizacao_(numeroConta) {
  const servico = obterServicoGmail_(numeroConta);
  const url = servico.getAuthorizationUrl();

  Logger.log('URL DE AUTORIZAÇÃO - CONTA ' + numeroConta);
  Logger.log(url);

  return url;
}

function gerarUrlAutorizacaoConta1() {
  return gerarUrlAutorizacao_(1);
}

function gerarUrlAutorizacaoConta2() {
  return gerarUrlAutorizacao_(2);
}

function gerarUrlAutorizacaoConta3() {
  return gerarUrlAutorizacao_(3);
}

/**
 * Processa os retornos de autorização.
 */
function authCallbackGmail1(request) {
  return processarCallbackGmail_(1, request);
}

function authCallbackGmail2(request) {
  return processarCallbackGmail_(2, request);
}

function authCallbackGmail3(request) {
  return processarCallbackGmail_(3, request);
}

/**
 * Função comum para processar os retornos OAuth.
 */
function processarCallbackGmail_(numeroConta, request) {
  const servico = obterServicoGmail_(numeroConta);
  const autorizado = servico.handleCallback(request);

  if (autorizado) {
    return HtmlService.createHtmlOutput(
      '<h2>Conta autorizada</h2>' +
      '<p>A Conta ' + numeroConta + ' foi conectada ao Correios.</p>' +
      '<p>Você já pode fechar esta página.</p>'
    );
  }

  return HtmlService.createHtmlOutput(
    '<h2>Autorização não concluída</h2>' +
    '<p>A Conta ' + numeroConta + ' não foi autorizada.</p>' +
    '<p>Você pode fechar esta página.</p>'
  );
}

/**
 * Executa uma requisição autenticada à API do Gmail.
 */
function requisicaoGmail_(numeroConta, caminho) {
  const servico = obterServicoGmail_(numeroConta);

  if (!servico.hasAccess()) {
    throw new Error(
      'A Conta ' + numeroConta + ' ainda não possui autorização válida.'
    );
  }

  const url = 'https://gmail.googleapis.com/gmail/v1/users/me/' + caminho;

  const resposta = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      Authorization: 'Bearer ' + servico.getAccessToken()
    },
    muteHttpExceptions: true
  });

  const codigo = resposta.getResponseCode();
  const conteudo = resposta.getContentText();

  if (codigo < 200 || codigo >= 300) {
    Logger.log('Erro na API Gmail. Código HTTP: ' + codigo);
    Logger.log(conteudo);

    throw new Error(
      'A API do Gmail retornou o código HTTP ' + codigo +
      ' na Conta ' + numeroConta + '.'
    );
  }

  return JSON.parse(conteudo);
}

/**
 * Consulta o perfil da conta Gmail conectada.
 */
function consultarPerfilGmail_(numeroConta) {
  const perfil = requisicaoGmail_(numeroConta, 'profile');

  const resultado = {
    conta: numeroConta,
    autorizada: true,
    email: perfil.emailAddress,
    mensagens: perfil.messagesTotal,
    conversas: perfil.threadsTotal
  };

  Logger.log(JSON.stringify(resultado, null, 2));
  return resultado;
}

function consultarPerfilConta1() {
  return consultarPerfilGmail_(1);
}

/**
 * Extrai o valor de um cabeçalho da mensagem.
 */
function obterCabecalho_(cabecalhos, nome) {
  const cabecalho = cabecalhos.find(function(item) {
    return item.name.toLowerCase() === nome.toLowerCase();
  });

  return cabecalho ? cabecalho.value : '';
}

/**
 * Lista mensagens de uma conta Gmail.
 * Por padrão, consulta as mensagens da caixa de entrada.
 */
function listarMensagensGmail_(numeroConta, consulta, tokenPagina) {
  validarNumeroConta_(numeroConta);

  const servico = obterServicoGmail_(numeroConta);

  if (!servico.hasAccess()) {
    throw new Error(
      'A Conta ' + numeroConta + ' ainda não possui autorização válida.'
    );
  }

  const parametros = [
    'maxResults=' + CORREIOS_CONFIG.MENSAGENS_POR_PAGINA
  ];

  if (consulta) {
    parametros.push('q=' + encodeURIComponent(consulta));
  }

  if (tokenPagina) {
    parametros.push('pageToken=' + encodeURIComponent(tokenPagina));
  }

  const lista = requisicaoGmail_(
    numeroConta,
    'messages?' + parametros.join('&')
  );

  const mensagens = (lista.messages || []).map(function(item) {
    const detalhes = requisicaoGmail_(
      numeroConta,
      'messages/' + encodeURIComponent(item.id) +
      '?format=metadata' +
      '&metadataHeaders=From' +
      '&metadataHeaders=To' +
      '&metadataHeaders=Subject' +
      '&metadataHeaders=Date'
    );

    const cabecalhos = detalhes.payload && detalhes.payload.headers
      ? detalhes.payload.headers
      : [];

    const data = detalhes.internalDate
      ? new Date(Number(detalhes.internalDate)).toISOString()
      : '';

    return {
      id: detalhes.id,
      threadId: detalhes.threadId,
      remetente: obterCabecalho_(cabecalhos, 'From'),
      destinatario: obterCabecalho_(cabecalhos, 'To'),
      assunto: obterCabecalho_(cabecalhos, 'Subject'),
      data: data,
      trecho: detalhes.snippet || '',
      lida: !(detalhes.labelIds || []).includes('UNREAD'),
      marcadores: detalhes.labelIds || []
    };
  });

  const resultado = {
    conta: numeroConta,
    consulta: consulta || 'in:inbox',
    totalEstimado: lista.resultSizeEstimate || 0,
    quantidadeRetornada: mensagens.length,
    proximaPagina: lista.nextPageToken || null,
    mensagens: mensagens
  };

  // O registro recebe apenas um resumo para evitar truncamento.
  // A função continua retornando o objeto completo ao chamador.
  const resumo = {
    conta: resultado.conta,
    consulta: resultado.consulta,
    totalEstimado: resultado.totalEstimado,
    quantidadeRetornada: resultado.quantidadeRetornada,
    possuiProximaPagina: Boolean(resultado.proximaPagina),
    mensagens: mensagens.map(function(mensagem) {
      return {
        id: mensagem.id,
        remetente: mensagem.remetente,
        assunto: mensagem.assunto,
        data: mensagem.data,
        lida: mensagem.lida
      };
    })
  };

  Logger.log(JSON.stringify(resumo, null, 2));
  return resultado;
}

/**
 * Lista as 20 mensagens mais recentes da caixa de entrada da Conta 1.
 */
function listarMensagensConta1() {
  return listarMensagensGmail_(1, 'in:inbox', null);
}

/**
 * Consulta o estado das três conexões.
 */
function consultarConexoes() {
  const resultado = [];

  for (
    let numeroConta = 1;
    numeroConta <= CORREIOS_CONFIG.MAX_CONTAS;
    numeroConta++
  ) {
    const servico = obterServicoGmail_(numeroConta);

    resultado.push({
      conta: numeroConta,
      autorizada: servico.hasAccess()
    });
  }

  Logger.log(JSON.stringify(resultado, null, 2));
  return resultado;
}
