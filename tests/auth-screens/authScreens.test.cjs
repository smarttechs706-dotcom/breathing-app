// Source checks for the restyled sign-in screens (visual change only). Run with:
//   node --test tests/auth-screens/authScreens.test.cjs
// Not under tests/auth, so `npm run test:auth` is unchanged. These only read
// source text; they check that the handlers, validation, API calls and
// navigation on every screen are still there after the restyle.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const repo = path.join(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(repo, f), 'utf8');

const MUST = {
  'app/(auth)/login.tsx': [
    'await getAuth().signInWithPassword({ email: address, password })',
    "router.push('/check-email')",
    "onPress={() => router.replace('/signup')}",
    'onPress={submit}',
    "onPress={() => router.push('/forgot-password')}",
  ],
  'app/(auth)/signup.tsx': [
    'await getAuth().signUp({',
    'options: { data: { display_name: name }, emailRedirectTo: AUTH_REDIRECT_URL }',
    "router.replace('/check-email')",
    "startCooldown('resend')",
    'onPress={submit}',
  ],
  'app/(auth)/forgot-password.tsx': [
    'await getAuth().resetPasswordForEmail(address, {',
    "useCooldown('forgot')",
    "onPress={() => router.replace('/login')}",
    'onPress={submit}',
  ],
  'app/(auth)/check-email.tsx': [
    'await getAuth().resend({',
    "useCooldown('resend')",
    "onPress={() => router.replace('/login')}",
    'onPress={resend}',
  ],
  'app/auth/callback.tsx': [
    'await getAuth().verifyOtp({',
    "await beginLink(target.type === 'recovery' ? 'recovery' : 'linkConfirm')",
    'await endLink()',
    'await signOut()',
    'onPress={useThisLink}',
    'onPress={retry}',
  ],
  'app/auth/signed-in.tsx': ['continuing.run(endLink)', 'leaving.run(signOut)'],
  'app/reset-password.tsx': ['await getAuth().updateUser({ password })', 'await endLink()', 'cancelling.run(signOut)'],
  'app/offline-restore.tsx': ['await retryRestore()', 'onPress={retry}'],
  'app/change-password.tsx': [
    'validatePasswordChange({ currentPassword, newPassword, confirmPassword })',
    'await changePassword(getAuth(), email, { currentPassword, newPassword })',
    'onPress={submit}',
    'onSubmitEditing={submitUnlessWaiting}',
    '<AuthScreen title="Change password" backTo="/settings">',
  ],
  'src/components/auth/AuthScreen.tsx': [
    'if (!backTo) return;',
    'if (router.canGoBack()) router.back();',
    'else router.replace(backTo);',
    '<KeyboardAvoidingView style={styles.keyboard} behavior="padding">',
    'keyboardShouldPersistTaps="handled"',
  ],
};

// Onboarding (restyle only): handlers, navigation, reminder calls and the time
// picker wiring stay as they were.
Object.assign(MUST, {
  'app/onboarding/welcome.tsx': [
    // Headline copy (2026-11-16); the line under it is unchanged.
    '<Text style={styles.headline} accessibilityRole="header">',
    'Breathe. Reset. Carry on.',
    'Built for busy workdays, with short guided breathing sessions you',
    'await setOnboardingComplete();',
    "router.replace('/signup');",
    '<Pressable onPress={skipToSignUp} hitSlop={8}>',
    "onPress={() => router.push('/onboarding/how-it-works')}",
  ],
  'app/onboarding/how-it-works.tsx': [
    'await setOnboardingComplete();',
    "router.replace('/signup');",
    '<Pressable onPress={skipToSignUp} hitSlop={8} style={styles.skipButton}>',
    "onPress={() => router.push('/onboarding/build-habit')}",
  ],
  'app/onboarding/build-habit.tsx': [
    // Body copy (2026-11-16): one sentence, the "Not a bedtime ritual" line removed.
    'One reset a day changes the rest of it.',
    "We'll remind you at the moments you actually need it.",
    'const result = await requestNotificationPermission();',
    'const result = await applyReminderSchedule(settings);',
    'await saveReminderSettings(settings);',
    "[{ text: 'OK', onPress: finishOnboarding }]",
    '<Pressable onPress={finishOnboarding} hitSlop={8}>',
    'onPress={finishOnboarding}',
    '<Pressable onPress={handleEnableReminders} hitSlop={8} style={styles.secondaryButton}>',
    'onConfirm={handleConfirmTime}',
    'onCancel={handleCancelTime}',
  ],
});

test('onboarding: mist backdrop, no panels or glows, sentence-case buttons, no direct font settings', () => {
  for (const f of ['app/onboarding/welcome.tsx', 'app/onboarding/how-it-works.tsx', 'app/onboarding/build-habit.tsx']) {
    const src = read(f);
    assert.ok(src.includes('<ScreenBackdrop painting={MIST_BACKGROUND} />'), f);
    assert.ok(!/GlassCard|PreviewGlass|backgroundGlow|GradientText|local-florist|colors\.background\b/.test(src), f);
    assert.ok(!/fontFamily:|fontWeight:|textTransform: 'uppercase'/.test(src), f);
    assert.ok(!/>NEXT<|Get Started|Enable Reminders/.test(src), f);
  }
});

for (const [file, snippets] of Object.entries(MUST)) {
  test(`${file} keeps its handlers, calls and navigation`, () => {
    const src = read(file);
    for (const s of snippets) assert.ok(src.includes(s), s);
  });
}

test('AuthScreen: mist backdrop, no card or panel, no flower logo or corner glow', () => {
  const src = read('src/components/auth/AuthScreen.tsx');
  assert.ok(src.includes('<ScreenBackdrop painting={MIST_BACKGROUND} />'));
  assert.ok(!/PreviewGlass|GlassCard|styles\.card/.test(src));
  assert.ok(!/local-florist|backgroundGlow|GradientText/.test(src));
});

test('AuthScreen: "Breathease" wordmark only when there is no back arrow; tighter spacing', () => {
  const src = read('src/components/auth/AuthScreen.tsx');
  assert.ok(/\{backTo \? \([\s\S]*?\) : \([\s\S]*?Breathease[\s\S]*?\)\}/.test(src), 'wordmark in the no-backTo branch');
  assert.ok(src.includes("color: 'rgba(255,255,255,0.8)'"));
  assert.ok(src.includes('gap: spacing.base * 3,'));
  // No new prop: the screens are unchanged.
  assert.ok(!/brand|wordmark\?:/.test(src.slice(src.indexOf('interface AuthScreenProps'), src.indexOf('export function AuthScreen'))));
});

test('TextField: faint dark fill, hairline border, lighter on focus; callers\' onFocus/onBlur still run', () => {
  const src = read('src/components/auth/TextField.tsx');
  assert.ok(src.includes("backgroundColor: 'rgba(255,255,255,0.04)'"));
  assert.ok(src.includes("borderColor: 'rgba(255,255,255,0.2)'"));
  assert.ok(src.includes('fieldFocused'));
  assert.ok(src.includes('inputProps.onFocus?.(e);') && src.includes('inputProps.onBlur?.(e);'));
});

test('fields and buttons: no uppercase labels, glass fields, no direct font family or weight', () => {
  for (const f of ['src/components/auth/TextField.tsx', 'src/components/auth/GradientButton.tsx']) {
    const src = read(f);
    assert.ok(!src.includes("textTransform: 'uppercase'"), f);
    assert.ok(!/fontFamily:|fontWeight:/.test(src), f);
  }
});

test('the (auth) stack background is navy; the root layout and its guards are untouched by this', () => {
  assert.ok(read('app/(auth)/_layout.tsx').includes("contentStyle: { backgroundColor: '#00051a' }"));
  const root = read('app/_layout.tsx');
  assert.ok(root.includes("<Stack.Protected guard={status === 'signedOut'}>"));
  assert.ok(root.includes("<Stack.Protected guard={status === 'signedIn'}>"));
});

test('build-habit body copy: the "Not a bedtime ritual" sentence is gone', () => {
  const src = read('app/onboarding/build-habit.tsx');
  assert.ok(!/bedtime ritual/i.test(src));
  assert.ok(/<Text style=\{styles\.body\}>\s*We'll remind you at the moments you actually need it\.\s*<\/Text>/.test(src));
});

test('onboarding headlines use text.name as is (24 / 36); the body keeps its 15 / 22', () => {
  for (const f of ['app/onboarding/welcome.tsx', 'app/onboarding/how-it-works.tsx', 'app/onboarding/build-habit.tsx']) {
    const src = read(f);
    const headline = src.slice(src.indexOf('  headline: {'), src.indexOf('},', src.indexOf('  headline: {')));
    assert.ok(headline.includes('...text.name,'), f);
    assert.ok(!/fontSize|lineHeight|fontFamily|fontWeight/.test(headline), `${f}: no size override`);
    const body = src.slice(src.indexOf('  body: {'), src.indexOf('},', src.indexOf('  body: {')));
    assert.ok(/\.\.\.text\.body,\s*fontSize: 15,\s*lineHeight: 22,/.test(body), `${f}: body unchanged`);
  }
});

test('onboarding layout: one shared body and footer, so the headline block and the primary button sit at the same place on all three', () => {
  const layout = read('src/features/onboarding/layout.ts');
  assert.ok(layout.includes('export const SECONDARY_ACTION_HEIGHT = spacing.base * 6;'));
  assert.ok(/body: \{\s*flexGrow: 1,\s*alignItems: 'center',\s*paddingHorizontal: spacing\.marginMobile,\s*paddingTop: spacing\.base \* 12,\s*paddingBottom: spacing\.base \* 2,\s*gap: spacing\.base \* 5,\s*\}/.test(layout));
  assert.ok(/footer: \{\s*paddingHorizontal: spacing\.marginMobile,\s*paddingTop: spacing\.base \* 2,\s*paddingBottom: spacing\.base \* 4,\s*gap: spacing\.base \* 2,\s*\}/.test(layout));
  assert.ok(!/fontSize|fontFamily|fontWeight|color/.test(layout), 'layout only');
  const welcome = read('app/onboarding/welcome.tsx');
  const how = read('app/onboarding/how-it-works.tsx');
  const habit = read('app/onboarding/build-habit.tsx');
  assert.ok(welcome.includes('<View style={onboardingLayout.body}>'));
  assert.ok(how.includes('contentContainerStyle={onboardingLayout.body}'));
  assert.ok(habit.includes('contentContainerStyle={onboardingLayout.body}'));
  for (const [f, src] of [['welcome', welcome], ['how-it-works', how], ['build-habit', habit]]) {
    assert.ok(src.includes('<View style={onboardingLayout.footer}>'), f);
    // The primary button is inside the pinned footer, not the body.
    const footer = src.slice(src.indexOf('<View style={onboardingLayout.footer}>'));
    assert.ok(/<LinearGradient/.test(footer), `${f}: primary button in the footer`);
  }
  // The slot under the primary button: empty on the first two, "Enable reminders" on the third.
  assert.ok(welcome.includes('<View style={onboardingLayout.secondarySlot} />'));
  assert.ok(how.includes('<View style={onboardingLayout.secondarySlot} />'));
  assert.ok(habit.includes('minHeight: SECONDARY_ACTION_HEIGHT,'));
  // Nothing centres the content vertically any more.
  for (const src of [welcome, how, habit]) assert.ok(!/justifyContent: 'space-between',\s*\},\s*topBar/.test(src));
});

test('build-habit text area scrolls only on short screens; the footer stays pinned outside it', () => {
  const habit = read('app/onboarding/build-habit.tsx');
  assert.ok(
    /<ScrollView\s+style=\{styles\.scroll\}\s+contentContainerStyle=\{onboardingLayout\.body\}\s+showsVerticalScrollIndicator=\{false\}\s+alwaysBounceVertical=\{false\}\s*>/.test(habit),
    'no scrollbar, no bounce when it fits'
  );
  assert.ok(/scroll: \{\s*flex: 1,\s*\}/.test(habit));
  // Illustration and text are inside the scroll area; the buttons come after it.
  const scrollStart = habit.indexOf('<ScrollView');
  const scrollEnd = habit.indexOf('</ScrollView>');
  const footer = habit.indexOf('<View style={onboardingLayout.footer}>');
  assert.ok(scrollStart > 0 && scrollStart < scrollEnd && scrollEnd < footer);
  const inside = habit.slice(scrollStart, scrollEnd);
  assert.ok(inside.includes('styles.illustrationWrap'));
  assert.ok(inside.includes('<Text style={styles.tip}>{REMINDER_TIP}</Text>'));
  assert.ok(!inside.includes('Get started') && !inside.includes('Enable reminders'));
  // how-it-works keeps its own scroll area the same way.
  const how = read('app/onboarding/how-it-works.tsx');
  assert.ok(how.indexOf('</ScrollView>') < how.indexOf('<View style={onboardingLayout.footer}>'));
});
