export default {
  init() {
    const style = document.createElement('style');
    style.textContent = `
      :root, body, .app, .v-application {
        background-color: #0F1729 !important;
        color: #E2E8F0 !important;
      }
      .v-application__wrap { background-color: #0F1729 !important; }
      [class*="app-header"], [class*="header-bar"], .v-app-bar, [class*="top-bar"] {
        background-color: #1E293B !important; border-bottom: 1px solid #334155 !important;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
      }
      [class*="app-header"] [class*="title"], [class*="app-logo"] {
        color: #E8A838 !important; font-family: 'JetBrains Mono', monospace !important;
        font-weight: 700 !important;
      }
      [class*="sidebar"], [class*="nav-drawer"], .v-navigation-drawer {
        background-color: #1E293B !important; border-right: 1px solid #334155 !important;
      }
      [class*="sidebar"] [class*="item"], [class*="nav-item"], .v-list-item {
        color: #94A3B8 !important;
      }
      [class*="sidebar"] [class*="item"]:hover, [class*="nav-item"]:hover, .v-list-item:hover {
        background-color: #283548 !important; color: #E2E8F0 !important;
      }
      [class*="sidebar"] [class*="item"][class*="active"], [class*="nav-item"][class*="active"], .v-list-item--active {
        color: #E8A838 !important; background-color: rgba(232,168,56,0.08) !important; border-left: 3px solid #E8A838 !important;
      }
      [class*="card"], [class*="panel"], .v-card, [class*="collection-item"] {
        background-color: #1E293B !important; border: 1px solid #334155 !important;
        border-radius: 8px !important;
      }
      [class*="btn"], button[class*="btn"], .v-btn {
        background: linear-gradient(90deg, #E8A838 0%, #FF6B4A 100%) !important;
        color: #0F1729 !important; border: none !important; border-radius: 6px !important;
        font-weight: 600 !important;
      }
      [class*="btn"]:hover, button[class*="btn"]:hover, .v-btn:hover {
        transform: translateY(-1px) !important;
        box-shadow: 0 4px 16px rgba(232,168,56,0.3) !important;
      }
      [class*="primary"], [class*="action"], [class*="save"] {
        background: linear-gradient(90deg, #E8A838 0%, #FF6B4A 100%) !important; color: #0F1729 !important;
      }
      input[type="text"], input[type="search"], input[type="password"], [class*="input"], .v-text-field, .v-input {
        background-color: #0F1729 !important; border: 1px solid #334155 !important;
        color: #E2E8F0 !important; border-radius: 6px !important;
      }
      input[type="text"]:focus, [class*="input"]:focus, .v-text-field--focused {
        border-color: #E8A838 !important; box-shadow: 0 0 0 2px rgba(232,168,56,0.15) !important;
      }
      [class*="table"] th, [class*="table-header"], .v-data-table th {
        color: #E8A838 !important; font-family: 'JetBrains Mono', monospace !important;
        text-transform: uppercase !important;
      }
      [class*="table"] tr:nth-child(even) { background-color: rgba(30,41,59,0.5) !important; }
      [class*="modal"], [class*="dialog"], .v-dialog { background-color: #1E293B !important; }
      ::-webkit-scrollbar { width: 8px; height: 8px; }
      ::-webkit-scrollbar-track { background: #1E293B; }
      ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
      ::-webkit-scrollbar-thumb:hover { background: #475569; }
      [class*="success"], [class*="ok"] { color: #4ADE80 !important; }
      [class*="warning"] { color: #FBBF24 !important; }
      [class*="error"], [class*="critical"] { color: #EF4444 !important; }
      [class*="spinner"], [class*="loading"] { color: #E8A838 !important; }
      [class*="tag"], [class*="chip"], .v-chip {
        background-color: rgba(232,168,56,0.15) !important; color: #E8A838 !important;
        border: 1px solid rgba(232,168,56,0.3) !important;
      }
      [class*="empty"], [class*="placeholder"] { color: #64748B !important; font-style: italic !important; }
      [class*="label"], .v-label { color: #E2E8F0 !important; font-weight: 500 !important; }
      [class*="helper"], [class*="caption"] { color: #94A3B8 !important; font-size: 0.8125rem !important; }
    `;
    document.head.appendChild(style);
  }
};
