"use client";

import { useAccess } from "./auth-context";
import { bottomNavItems, filterNav, flatNavItems, MAIN_NAV, SETTINGS_NAV, type NavItem } from "./nav-config";

/// Menu admin web yang sudah disaring sesuai hak akses user (BR-044) — satu-satunya
/// sumber menu untuk Sidebar, HorizontalMenu, BottomBar, dan CommandPalette.
export function useNav() {
  const { canView, isOwner } = useAccess();
  const boleh = (item: NavItem) => (item.ownerOnly ? isOwner : !item.menu || canView(item.menu));
  const mainNav = filterNav(MAIN_NAV, boleh);
  const settingsNav = filterNav(SETTINGS_NAV, boleh);
  const navGroups = [...mainNav, ...settingsNav];
  return { mainNav, settingsNav, navGroups, flatItems: flatNavItems(navGroups), bottomItems: bottomNavItems(navGroups) };
}
