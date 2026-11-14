export const getFontFamilyStyle = (fontKey?: string): string => {
  switch (fontKey) {
    case 'rajdhani':
      return "'Rajdhani', sans-serif";
    case 'orbitron':
      return "'Orbitron', sans-serif";
    case 'russo':
      return "'Russo One', sans-serif";
    case 'teko':
      return "'Teko', sans-serif";
    case 'sans':
      return "'Inter', system-ui, sans-serif";
    case 'serif':
      return "'Georgia', serif";
    case 'mono':
    default:
      return "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Roboto Mono', monospace";
  }
};
