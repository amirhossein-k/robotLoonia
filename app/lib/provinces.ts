export const provinces: { [key: string]: string } = {
  azarbaijan_east: "آذربایجان شرقی",
  azarbaijan_west: "آذربایجان غربی",
  ardabil: "اردبیل",
  esfahan: "اصفهان",
  alborz: "البرز",
  ilam: "ایلام",
  bushehr: "بوشهر",
  tehran: "تهران",
  chaharmahal_bakhtiari: "چهارمحال و بختیاری",
  khorasan_south: "خراسان جنوبی",
  khorasan_razavi: "خراسان رضوی",
  khorasan_north: "خراسان شمالی",
  khuzestan: "خوزستان",
  zanjan: "زنجان",
  semnan: "سمنان",
  sistan_baluchestan: "سیستان و بلوچستان",
  fars: "فارس",
  ghazvin: "قزوین",
  qom: "قم",
  kordestan: "کردستان",
  kerman: "کرمان",
  kermanshah: "کرمانشاه",
  kohgiluyeh_boyerahmad: "کهگیلویه و بویراحمد",
  golestan: "گلستان",
  gilan: "گیلان",
  loristan: "لرستان",
  mazandaran: "مازندران",
  markazi: "مرکزی",
  hormozgan: "هرمزگان",
  hamedan: "همدان",
  yazd: "یزد",
};

export function getProvinceKeyboard(forSearch = false) {
  const keys = Object.keys(provinces);
  const keyboard = [];

  for (let i = 0; i < keys.length; i += 2) {
    const row = [];

    row.push({
      text: provinces[keys[i]],
      callback_data: forSearch ? `search_province_${keys[i]}` : `profile_province_${keys[i]}`,
    });

    if (keys[i + 1]) {
      row.push({
        text: provinces[keys[i + 1]],
        callback_data: forSearch ? `search_province_${keys[i + 1]}` : `profile_province_${keys[i + 1]}`,
      });
    }

    keyboard.push(row);
  }

  return { reply_markup: { inline_keyboard: keyboard } };
}
