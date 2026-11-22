(function () {
  'use strict'

  const config = window.QQFARM_PORTAL_CONFIG || {}
  const apiBase = config.nodesApiUrl === false ? './api.php' : String(config.nodesApiUrl || './api.php').trim()
  const accessConfig = config.access || {}
  const captchaEnabled = accessConfig.captchaEnabled === true
  const identifierMode = ['username', 'card', 'both'].includes(accessConfig.identifierMode) ? accessConfig.identifierMode : 'both'

  const form = document.getElementById('accessForm')
  const identifierInput = document.getElementById('accessIdentifier')
  const captchaImage = document.getElementById('captchaImage')
  const captchaAnswer = document.getElementById('captchaAnswer')
  const captchaQuestion = document.getElementById('captchaQuestion')
  const refreshButton = document.getElementById('refreshCaptcha')
  const submitButton = document.getElementById('bestNodeAction')
  const status = document.getElementById('accessStatus')
  const captchaRow = document.querySelector('.captcha-row')
  const identifierLabel = document.getElementById('identifierLabel')
  const nodesList = document.getElementById('nodesList')
  const nodesStatus = document.getElementById('nodesStatus')
  const nodesUpdated = document.getElementById('nodesUpdated')
  const refreshIntervalMs = Math.max(15000, Number(config.refreshIntervalMs) || 60000)

  let captchaId = ''
  let loading = false

  function actionUrl(action) {
    return `${apiBase}${apiBase.includes('?') ? '&' : '?'}action=${encodeURIComponent(action)}`
  }

  function normalizeUrl(value) {
    const text = String(value || '').trim()
    if (!text) return ''
    if (/^(?:\.{0,2}\/|[?#])/i.test(text)) return new URL(text, window.location.href).toString()
    return /^https?:\/\//i.test(text) ? text : `http://${text}`
  }

  async function requestJson(url, options, timeoutMs) {
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(url, { ...options, signal: controller.signal })
      const data = await response.json()
      if (!response.ok || !data || data.ok === false) {
        throw new Error(data && data.error ? data.error : '请求失败，请稍后重试')
      }
      return data
    } catch (error) {
      if (error && error.name === 'AbortError') throw new Error('请求超时，请刷新后重试')
      throw error
    } finally {
      window.clearTimeout(timer)
    }
  }

  function setStatus(message, type) {
    status.textContent = String(message || '')
    status.className = `access-status${type ? ` is-${type}` : ''}`
  }

  function setNodesStatus(message, type) {
    nodesStatus.textContent = String(message || '')
    nodesStatus.className = `nodes-status${type ? ` is-${type}` : ''}`
  }

  function renderNodes(nodes) {
    nodesList.innerHTML = ''
    if (!Array.isArray(nodes) || nodes.length === 0) {
      setNodesStatus('暂时没有已开启门户显示的节点', 'empty')
      return
    }

    const fragment = document.createDocumentFragment()
    nodes.forEach(node => {
      const card = document.createElement('article')
      card.className = `node-card${node.online ? '' : ' is-offline'}`
      const statusText = node.online ? '运行中' : '暂时离线'
      const count = Number(node.usersCount || 0)
      const max = Number(node.maxUsers || 0)
      const full = node.full === true || node.canAddAccount === false
      const canEnter = node.online === true && !full && normalizeUrl(node.url)
      const capacityText = node.canAddAccount === false ? '当前负载已满' : (full ? '节点已满' : statusText)
      card.innerHTML = `<div class="node-card__top"><strong>${escapeHtml(node.name || '未命名节点')}</strong><span class="node-status"><i></i>${escapeHtml(capacityText)}</span></div><div class="node-card__meta"><span>在线用户 ${count}${max > 0 ? ` / ${max}` : ''}</span></div><div class="node-card__action">${canEnter ? `<a class="node-enter" href="${escapeHtml(normalizeUrl(node.url))}" target="_blank" rel="noopener">进入节点<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"></path></svg></a>` : `<span class="node-enter is-disabled">${node.canAddAccount === false ? '当前负载已满' : (full ? '节点已满' : '暂不可进入')}</span>`}</div>`
      fragment.appendChild(card)
    })
    nodesList.appendChild(fragment)
    setNodesStatus('', '')
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]))
  }

  async function loadNodes() {
    // 纯静态托管（如 GitHub Pages）时，直接使用 portal.config.js 里配置的节点
    if (Array.isArray(config.nodes) && config.nodes.length > 0) {
      let nodes = config.nodes
      // stats.json 由服务器定时任务生成，包含两个节点的实时在线数
      try {
        const res = await fetch(`./stats.json?v=${Date.now()}`, { cache: 'no-store' })
        if (res.ok) {
          const stats = await res.json()
          nodes = nodes.map((n, i) => {
            const s = i === 0 ? stats.n1 : (i === 1 ? stats.n2 : null)
            if (s && s.ok) {
              return { ...n, usersCount: Number(s.online) || 0 }
            }
            return n
          })
          if (stats.updatedAt) {
            const t = new Date(stats.updatedAt)
            nodesUpdated.textContent = `更新于 ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`
          }
        }
      } catch {}
      renderNodes(nodes)
      if (!nodesUpdated.textContent || nodesUpdated.textContent.indexOf('更新于') < 0) {
        nodesUpdated.textContent = `${nodes.length} 条线路`
      }
      return
    }
    try {
      const data = await requestJson(actionUrl('nodes'), { method: 'GET', cache: 'no-store' }, 10000)
      renderNodes(data.nodes)
      nodesUpdated.textContent = `刚刚更新 · ${Array.isArray(data.nodes) ? data.nodes.length : 0} 个节点`
    } catch (error) {
      setNodesStatus(error.message || '节点状态获取失败', 'error')
      nodesUpdated.textContent = '状态获取失败'
    }
  }

  function updateControls() {
    submitButton.disabled = loading || (captchaEnabled && !captchaId)
    submitButton.classList.toggle('is-disabled', submitButton.disabled)
    submitButton.setAttribute('aria-busy', loading ? 'true' : 'false')
    refreshButton.disabled = loading
    identifierInput.disabled = loading
    captchaAnswer.disabled = loading
  }

  function configureForm() {
    const labels = { username: '用户名', card: '卡密', both: '用户名或卡密' }
    const placeholders = { username: '请输入用户名', card: '请输入卡密', both: '请输入用户名或卡密' }
    identifierLabel.textContent = labels[identifierMode]
    identifierInput.placeholder = placeholders[identifierMode]
    captchaRow.hidden = !captchaEnabled
    form.noValidate = !captchaEnabled
    captchaAnswer.required = captchaEnabled
    captchaAnswer.disabled = !captchaEnabled
    refreshButton.disabled = !captchaEnabled
    if (!captchaEnabled) captchaId = 'disabled'
  }

  async function loadCaptcha(preserveStatus) {
    if (!captchaEnabled) {
      captchaId = 'disabled'
      updateControls()
      return
    }
    captchaId = ''
    captchaAnswer.value = ''
    captchaImage.removeAttribute('src')
    captchaImage.alt = '4位数字验证码加载中'
    captchaQuestion.textContent = '图片数字'
    updateControls()

    try {
      const data = await requestJson(actionUrl('captcha'), { method: 'GET', cache: 'no-store' }, 8000)
      captchaId = String(data.captchaId || '')
      captchaImage.src = String(data.imageUrl || `${actionUrl('captcha_image')}&id=${encodeURIComponent(captchaId)}`)
      captchaImage.alt = '4位数字验证码'
      if (!preserveStatus) setStatus('', '')
    } catch (error) {
      captchaImage.alt = '验证码加载失败'
      if (!preserveStatus) setStatus(error.message || '验证码加载失败', 'error')
    } finally {
      updateControls()
    }
  }

  async function authorize() {
    // 静态托管模式：不走后端验证，直接打开配置里的第一条线路
    if (Array.isArray(config.nodes) && config.nodes.length > 0) {
      const target = config.nodes.find(n => n && n.url) || config.nodes[0]
      if (target && target.url) {
        setStatus('正在打开线路…', 'ok')
        performJump(target.url)
        return
      }
    }
    const identifier = identifierInput.value.trim()
    if (!identifier) {
      setStatus('请输入用户名或卡密', 'error')
      identifierInput.focus()
      return
    }
    const answer = captchaAnswer.value.trim()
    if (captchaEnabled && (!captchaId || !answer)) {
      setStatus('请输入图片中的4位数字', 'error')
      captchaAnswer.focus()
      return
    }

    loading = true
    updateControls()
    setStatus('正在验证，请稍候', '')
    try {
      const data = await requestJson(actionUrl('authorize'), {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, ...(captchaEnabled ? { captchaId, captchaAnswer: answer } : {}) }),
      }, 12000)
      setStatus('验证通过，正在打开节点…', 'ok')
      performJump(data.redirectUrl)
    } catch (error) {
      setStatus(error.message || '验证失败，请重试', 'error')
      if (captchaEnabled) {
        await loadCaptcha(true)
        captchaAnswer.focus()
      }
    } finally {
      loading = false
      updateControls()
    }
  }

  function performJump(url) {
    const target = normalizeUrl(url)
    if (!target) return
    window.location.href = target
  }

  form.addEventListener('submit', event => {
    event.preventDefault()
    authorize()
  })
  refreshButton.addEventListener('click', () => loadCaptcha(false))

  configureForm()
  updateControls()
  loadNodes()
  window.setInterval(loadNodes, refreshIntervalMs)
  if (captchaEnabled) loadCaptcha(false)
})()
