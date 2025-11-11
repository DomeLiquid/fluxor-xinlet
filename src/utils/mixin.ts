export function checkMessenger(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Mixin\/(iOS|Android|Desktop)/i.test(navigator.userAgent)
}