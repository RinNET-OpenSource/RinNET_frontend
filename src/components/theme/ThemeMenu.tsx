import { CircleHalf, Stars, Sun } from 'react-bootstrap-icons';
import { useTranslation } from 'react-i18next';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { THEME_FAMILIES } from '@/lib/theme-catalog';
import { setTheme, useTheme, type ColorTheme } from '@/lib/theme';

const colorThemes: ColorTheme[] = ['auto', 'light', 'dark'];

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function ThemeMenu() {
  const { t } = useTranslation();
  const theme = useTheme();
  const icon =
    theme.colorTheme === 'auto' ? <CircleHalf /> : theme.colorTheme === 'light' ? <Sun /> : <Stars />;
  const itemClassName = (selected: boolean) =>
    'theme-menu-item' + (selected ? ' theme-menu-item--active' : '');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <a
          className="theme-menu-trigger dropdown-toggle d-flex align-items-center cursor-pointer"
          aria-label={t('App.Footer.Theme')}
        >
          {icon}
          <span className="ms-1">{t(`App.Footer.${titleCase(theme.colorTheme)}`)}</span>
        </a>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={4}
        className="theme-menu-content"
      >
        <DropdownMenuLabel className="theme-menu-label p-[0]">
          {t('App.Footer.ThemeFamily')}
        </DropdownMenuLabel>
        {THEME_FAMILIES.map((item) => (
          <DropdownMenuItem
            key={item.id}
            className={itemClassName(theme.family === item.id)}
            onSelect={() => setTheme({ family: item.id })}
          >
            {t(item.labelKey)}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="theme-menu-label p-[0]">
          {t('App.Footer.ColorTheme')}
        </DropdownMenuLabel>
        {colorThemes.map((item) => (
          <DropdownMenuItem
            key={item}
            className={itemClassName(theme.colorTheme === item)}
            onSelect={() => setTheme({ colorTheme: item })}
          >
            {t(`App.Footer.${titleCase(item)}`)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
