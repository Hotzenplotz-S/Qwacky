type BrowserType = typeof chrome;
declare const browser: BrowserType;
const api: BrowserType = typeof browser !== 'undefined' ? browser : chrome;

const setupConnection = () => {
  try {
    api.runtime.connect();
    return true;
  } catch {
    window.location.reload();
    return false;
  }
}

let activeNotification: HTMLElement | null = null
let dismissTimer: ReturnType<typeof setTimeout> | null = null

const dismissNotification = () => {
  if (dismissTimer) {
    clearTimeout(dismissTimer)
    dismissTimer = null
  }
  activeNotification?.remove()
  activeNotification = null
}

const createSpinner = () => {
  const spinner = document.createElement('span')
  Object.assign(spinner.style, {
    width: '14px',
    height: '14px',
    flex: '0 0 auto',
    borderRadius: '50%',
    boxSizing: 'border-box',
    border: '2px solid rgba(255, 255, 255, 0.35)',
    borderTopColor: '#fff'
  })
  spinner.animate(
    [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
    { duration: 700, iterations: Infinity }
  )
  return spinner
}

const PENDING_TIMEOUT_MS = 20000
const DISMISS_TIMEOUT_MS = 3000

const showNotification = (message: string, pending = false) => {
  dismissNotification()

  const notification = document.createElement('div')
  const styles = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    background: '#ff9f19',
    color: 'white',
    padding: '16px 24px',
    borderRadius: '8px',
    zIndex: '999999',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  }
  Object.assign(notification.style, styles)
  notification.setAttribute('role', 'status')
  notification.setAttribute('aria-live', 'polite')

  if (pending) {
    notification.appendChild(createSpinner())
  }

  const label = document.createElement('span')
  label.textContent = message === 'Not authenticated' ? '请先登录' : message
  notification.appendChild(label)

  document.body.appendChild(notification)
  activeNotification = notification

  dismissTimer = setTimeout(
    dismissNotification,
    pending ? PENDING_TIMEOUT_MS : DISMISS_TIMEOUT_MS
  )
}

const fillInput = (element: HTMLElement | null, value: string) => {
  if (!element) return false

  const fullAddress = `${value}@duck.com`

  try {
    if (element.isContentEditable) {
      element.textContent = fullAddress
      return true
    }

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      element.value = fullAddress

      element.dispatchEvent(new Event('input', { bubbles: true }))
      element.dispatchEvent(new Event('change', { bubbles: true }))
      
      return true
    }
  } catch {
    return false
  }

  return false
}

const replaceSelection = (value: string, find?: string) => {
  const element = document.activeElement as HTMLElement | null
  if (!element) return false

  try {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      const start = element.selectionStart
      const end = element.selectionEnd
      if (start !== null && end !== null && start !== end) {
        element.setRangeText(value, start, end, 'end')
      } else if (find && element.value.includes(find)) {
        const index = element.value.indexOf(find)
        element.setRangeText(value, index, index + find.length, 'end')
      } else {
        element.value = value
      }
      element.dispatchEvent(new Event('input', { bubbles: true }))
      element.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    }

    if (element.isContentEditable) {
      return document.execCommand('insertText', false, value)
    }
  } catch {
    return false
  }

  return false
}

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

if (!(window as unknown as { __qwackyContentScript?: boolean }).__qwackyContentScript) {
  (window as unknown as { __qwackyContentScript?: boolean }).__qwackyContentScript = true

  api.runtime.onMessage.addListener(async (message, _sender) => {
    if (!setupConnection()) return;

    if (message.type === 'fill-address') {
      const activeElement = document.activeElement as HTMLElement | null
      const filled = fillInput(activeElement, message.address)

      const copied = await copyToClipboard(`${message.address}@duck.com`);

      if (!filled) {
        showNotification(copied
          ? '无法填充输入框，地址已复制到剪贴板'
          : '无法填充输入框或复制到剪贴板，请检查设置中的权限。');
      } else {
        showNotification(copied
          ? '地址已填充并复制到剪贴板'
          : '地址已填充，但无法复制到剪贴板，请检查设置中的权限。');
      }
    }

    if (message.type === 'replace-selection') {
      const replaced = replaceSelection(message.text, message.find)
      const copied = await copyToClipboard(message.text)

      if (!replaced) {
        showNotification(copied
          ? '无法替换选中文本，地址已复制到剪贴板'
          : '无法替换选中文本或复制到剪贴板，请检查设置中的权限。');
      } else {
        showNotification(copied
          ? '已转换并复制到剪贴板'
          : '已完成转换，但无法复制到剪贴板，请检查设置中的权限。');
      }
    }

    if (message.type === 'show-pending') {
      showNotification(message.message, true)
    }

    if (message.type === 'show-notification') {
      showNotification(message.message)
    }
  })
}

export {}