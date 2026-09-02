/** 旧版 pipes 的等价实现 */

/** 全角化（fullWidth pipe） */
export function fullWidth(value: string): string {
  return Array.from(value)
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code === 0x20) {
        return String.fromCharCode(0x3000);
      } else if (code >= 0x21 && code <= 0x7e) {
        return String.fromCharCode(code + 0xfee0);
      }
      return char;
    })
    .join('');
}

/** toDate pipe */
export function toDate(value: string): Date {
  return new Date(value);
}

/** chuni 角色 id → 图片名片段（characterImage pipe） */
export function characterImage(characterId: number | string): string {
  const id = Number(characterId);
  const prefix = Math.floor(id / 10).toString().padStart(4, '0');
  const suffix = (id % 10).toString().padStart(2, '0');
  return `${prefix}_${suffix}`;
}

/** 指定位数前导零 */
export function padDigits(input: string | number, digit: number): string {
  return input.toString().padStart(digit, '0');
}

/** 数字格式化（Angular number pipe 简化版：min-max 小数位） */
export function formatNumber(value: number, minFractionDigits = 0, maxFractionDigits = 2): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: minFractionDigits,
    maximumFractionDigits: maxFractionDigits,
  });
}

/** 版本比较（dashboard 的 compareVersion） */
export function compareVersion(version: string, target: string, operator: '>=' | '<'): boolean {
  const a = version.split('.').map(Number);
  const b = target.split('.').map(Number);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const n1 = a[i] || 0;
    const n2 = b[i] || 0;
    if (n1 > n2) return operator === '>=';
    if (n1 < n2) return operator === '<';
  }
  return operator === '>=';
}

/** 序数（ordinal pipe：1st/2nd/3rd…） */
export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
