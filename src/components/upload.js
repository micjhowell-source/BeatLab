export function createUploadWidget(container, soundId) {
  const el = document.createElement('div')
  el.className = 'upload-widget'
  el.textContent = 'Upload widget — coming in Phase 4.'
  container.appendChild(el)
  return el
}
