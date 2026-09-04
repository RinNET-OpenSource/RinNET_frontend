import { CircleHalf, Palette, Stars, Sun } from 'react-bootstrap-icons';
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <a className="dropdown-toggle d-flex align-items-center cursor-pointer" aria-label={t('App.Footer.Theme')}>
          {icon}
          <span className="ms-1">{t(`App.Footer.${titleCase(theme.colorTheme)}`)}</span>
        </a>
      </DropdownMenuTrigger>
      {theme.family === 'legacy' ? (
        <DropdownMenuContent
          align="start"
          sideOffset={2}
          className="shell-legacy-dropdown shell-legacy-theme-dropdown"
        >
          <DropdownMenuItem
            aria-label={t('App.Footer.Modern')}
            title={`${t('App.Footer.ThemeFamily')}: ${t('App.Footer.Modern')}`}
            className="shell-theme-family-switch"
            onSelect={() => setTheme({ family: 'modern' })}
          >
            <Palette aria-hidden="true" />
          </DropdownMenuItem>
          {colorThemes.map((item) => (
            <DropdownMenuItem
              key={item}
              className={
                'shell-dropdown-item small my-1' +
                (theme.colorTheme === item ? ' active bg-[var(--bs-tertiary-bg)] font-bold' : '')
              }
              onSelect={() => setTheme({ colorTheme: item })}
            >
              {t(`App.Footer.${titleCase(item)}`)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      ) : (
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>{t('App.Footer.ThemeFamily')}</DropdownMenuLabel>
          {THEME_FAMILIES.map((item) => (
            <DropdownMenuItem
              key={item.id}
              className={theme.family === item.id ? 'bg-[var(--bs-tertiary-bg)] font-bold' : ''}
              onSelect={() => setTheme({ family: item.id })}
            >
              {t(item.labelKey)}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t('App.Footer.ColorTheme')}</DropdownMenuLabel>
          {colorThemes.map((item) => (
            <DropdownMenuItem
              key={item}
              className={theme.colorTheme === item ? 'bg-[var(--bs-tertiary-bg)] font-bold' : ''}
              onSelect={() => setTheme({ colorTheme: item })}
            >
              {t(`App.Footer.${titleCase(item)}`)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  );
}
