import {
  Link,
  NavLink,
  type LinkProps,
  type NavLinkProps,
} from 'react-router-dom'

/** يمنع فتح المسار في تبويب/نافذة جديدة — يبقى التنقل داخل نفس جلسة البوابة (/branch vs /admin). */
const preventNewTabNav = {
  onContextMenu: (e: React.MouseEvent) => {
    e.preventDefault()
  },
  onAuxClick: (e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault()
      e.stopPropagation()
    }
  },
  draggable: false as const,
}

function blockModifiedClick(e: React.MouseEvent) {
  if (e.ctrlKey || e.metaKey || e.shiftKey) {
    e.preventDefault()
    e.stopPropagation()
  }
}

export function AppNavLink(props: NavLinkProps) {
  const { onContextMenu, onAuxClick, onClick, ...rest } = props
  return (
    <NavLink
      {...rest}
      draggable={false}
      onContextMenu={(e) => {
        preventNewTabNav.onContextMenu(e)
        onContextMenu?.(e)
      }}
      onAuxClick={(e) => {
        preventNewTabNav.onAuxClick(e)
        onAuxClick?.(e)
      }}
      onClick={(e) => {
        blockModifiedClick(e)
        onClick?.(e)
      }}
    />
  )
}

export function AppLink(props: LinkProps) {
  const { onContextMenu, onAuxClick, onClick, ...rest } = props
  return (
    <Link
      {...rest}
      draggable={false}
      onContextMenu={(e) => {
        preventNewTabNav.onContextMenu(e)
        onContextMenu?.(e)
      }}
      onAuxClick={(e) => {
        preventNewTabNav.onAuxClick(e)
        onAuxClick?.(e)
      }}
      onClick={(e) => {
        blockModifiedClick(e)
        onClick?.(e)
      }}
    />
  )
}