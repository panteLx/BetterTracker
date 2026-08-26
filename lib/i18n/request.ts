import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { env } from "@/lib/env";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isSupportedLocale, type Locale } from "@/lib/i18n/config";

async function loadMessages(locale: Locale) {
  const [
    common,
    nav,
    dashboard,
    trackers,
    transactions,
    schedules,
    statistics,
    admin,
    profile,
    auth,
    publicShare,
    errors,
    cases,
    noAccess,
  ] = await Promise.all([
    import(`../../messages/${locale}/common.json`),
    import(`../../messages/${locale}/nav.json`),
    import(`../../messages/${locale}/dashboard.json`),
    import(`../../messages/${locale}/trackers.json`),
    import(`../../messages/${locale}/transactions.json`),
    import(`../../messages/${locale}/schedules.json`),
    import(`../../messages/${locale}/statistics.json`),
    import(`../../messages/${locale}/admin.json`),
    import(`../../messages/${locale}/profile.json`),
    import(`../../messages/${locale}/auth.json`),
    import(`../../messages/${locale}/public-share.json`),
    import(`../../messages/${locale}/errors.json`),
    import(`../../messages/${locale}/cases.json`),
    import(`../../messages/${locale}/no-access.json`),
  ]);

  return {
    Common: common.default,
    Nav: nav.default,
    Dashboard: dashboard.default,
    Trackers: trackers.default,
    Transactions: transactions.default,
    Schedules: schedules.default,
    Statistics: statistics.default,
    Admin: admin.default,
    Profile: profile.default,
    Auth: auth.default,
    PublicShare: publicShare.default,
    Errors: errors.default,
    Cases: cases.default,
    NoAccess: noAccess.default,
  };
}

export default getRequestConfig(async () => {
  const store = await cookies();
  const raw = store.get(LOCALE_COOKIE)?.value;
  const locale: Locale = isSupportedLocale(raw) ? raw : DEFAULT_LOCALE;

  return {
    locale,
    messages: await loadMessages(locale),
    timeZone: env.timezone,
  };
});
