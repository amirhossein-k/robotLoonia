// تابع برای پیدا کردن کاربر بر اساس نام
export function findTelegramIdByName(name) {
  const user = users.find((u) => u.name === name);
  return user ? user.telegramId : null;
}
