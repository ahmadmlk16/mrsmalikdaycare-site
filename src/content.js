// Default homepage content. Everything here can be edited from the admin
// dashboard; these values are only used until the admin saves changes.
import { str } from './util.js';
import { BASE_THEMES, HOLIDAY_THEMES } from './themes.js';

export const DEFAULT_SITE = {
  name: "Mrs. Malik's Daycare",
  enrollmentStatus: 'Now enrolling',
  badges: [{ text: 'Now enrolling', color: 'green' }],
  theme: 'warm',
  holidayThemes: true,
  holidays: HOLIDAY_THEMES,
  holidayBanner: true,
  holidayEffects: true,
  heroTitle: 'A warm, loving home away from home',
  heroSubtitle:
    'Licensed family home daycare in Alexandria, VA. Small groups, home-cooked meals, and caring attention for every child.',
  coverPhotoId: '',
  ages: '3 months – 5 years',
  license: 'Licensed Virginia Family Day Home',
  phone: '(703) 000-0000',
  email: 'mrsmalikdaycare@gmail.com',
  area: 'Alexandria, VA 22304',
  address: '1001 N Vail St, Alexandria, VA 22304',
  googlePlaceId: 'ChIJ715gF8izt4kRneZHK1m_L_c',
  googleRating: '5.0',
  googleReviewCount: '19',
  showReviews: true,
  featuredReviews: [],
  hours: [{ days: 'Monday – Friday', time: '7:00 AM – 6:00 PM' }],
  storyTitle: 'Our story',
  storyBody:
    "Mrs. Malik opened her home to families because she believes every child deserves to feel safe, known, and loved while their parents are at work.\n\nWhat started as caring for a few neighborhood children has grown into a licensed family day home where kids learn, play, share meals, and make their first friends. With a small group, every child gets real one-on-one attention, and parents get a caregiver who treats their little ones like family.",
  storyPhotoId: '',
  providersTitle: 'Meet our providers',
  providersIntro: 'The caring people who look after your little ones every day.',
  providers: [
    {
      name: 'Mrs. Malik',
      role: 'Owner & lead provider',
      photoId: '',
      bio: 'Mrs. Malik runs the daycare from her home and cares for every child like her own. She is certified in CPR and First Aid and completes early childhood training every year.',
    },
  ],
  highlights: [
    { title: 'Licensed & inspected', text: 'State licensed family day home with regular inspections.' },
    { title: 'CPR & First Aid', text: 'Certified in CPR and First Aid, with ongoing training every year.' },
    { title: 'Home-cooked meals', text: 'Healthy breakfast, lunch, and snacks prepared fresh every day.' },
  ],
  schedule: [
    { time: '7:00 AM', activity: 'Arrival & free play', detail: 'Warm welcomes, quiet toys, and books.' },
    { time: '8:00 AM', activity: 'Breakfast', detail: 'A healthy start to the day.' },
    { time: '9:00 AM', activity: 'Circle time & learning', detail: 'Songs, stories, letters, numbers, and colors.' },
    { time: '10:00 AM', activity: 'Outdoor play', detail: 'Fresh air and running around (weather permitting).' },
    { time: '11:30 AM', activity: 'Lunch', detail: 'Home-cooked and kid-approved.' },
    { time: '12:30 PM', activity: 'Nap & quiet time', detail: 'Rest for little bodies and busy minds.' },
    { time: '3:00 PM', activity: 'Snack', detail: 'Fruit, crackers, yogurt, and milk.' },
    { time: '3:30 PM', activity: 'Arts, crafts & play', detail: 'Painting, building, pretend play, and music.' },
    { time: '5:00 PM', activity: 'Pickup', detail: 'A quick chat with parents about the day.' },
  ],
  faqs: [
    { q: 'What ages do you care for?', a: 'We care for children from 3 months to 5 years old.' },
    { q: 'What are your hours?', a: 'We are open Monday through Friday, 7:00 AM to 6:00 PM.' },
    { q: 'Are meals included?', a: 'Yes. Breakfast, lunch, and an afternoon snack are prepared fresh at home and included.' },
    { q: 'Are you licensed?', a: 'Yes. We are a licensed Virginia Family Day Home and are inspected regularly.' },
    { q: 'How do I schedule a visit?', a: 'Use the form at the bottom of this page or give us a call. We would love to meet you and your little one.' },
  ],
  contactIntro:
    "Have a question or want to come see our space? Send us a message and we'll get back to you within a day.",
};

export const BADGE_COLORS = ['green', 'orange', 'blue', 'pink', 'yellow'];

const LIMITS = { short: 120, medium: 400, long: 5000 };

function list(input, max, mapItem) {
  if (!Array.isArray(input)) return [];
  return input.slice(0, max).map(mapItem).filter((item) => Object.values(item).some((v) => v));
}

// Accept only known fields with sane lengths, so the admin form can't store junk.
export function cleanSite(input) {
  const s = { ...DEFAULT_SITE, ...(input || {}) };
  return {
    name: str(s.name, LIMITS.short),
    enrollmentStatus: str(s.enrollmentStatus, LIMITS.short),
    theme: BASE_THEMES.includes(s.theme) ? s.theme : 'warm',
    holidayThemes: s.holidayThemes !== false,
    holidays: Array.isArray(s.holidays) ? HOLIDAY_THEMES.filter((k) => s.holidays.includes(k)) : HOLIDAY_THEMES,
    holidayBanner: s.holidayBanner !== false,
    holidayEffects: s.holidayEffects !== false,
    // Older saves only had one "enrollmentStatus" badge; turn it into the list.
    badges: list(
      input && input.badges === undefined
        ? s.enrollmentStatus ? [{ text: s.enrollmentStatus, color: 'green' }] : []
        : s.badges,
      6,
      (b) => ({ text: str(b?.text, 60), color: BADGE_COLORS.includes(b?.color) ? b.color : 'green' }),
    ).filter((b) => b.text),
    heroTitle: str(s.heroTitle, LIMITS.short),
    heroSubtitle: str(s.heroSubtitle, LIMITS.medium),
    coverPhotoId: str(s.coverPhotoId, 64),
    ages: str(s.ages, LIMITS.short),
    license: str(s.license, LIMITS.short),
    phone: str(s.phone, 40),
    email: str(s.email, 200),
    area: str(s.area, LIMITS.short),
    address: str(s.address, 200),
    googlePlaceId: str(s.googlePlaceId, 300).replace(/[^A-Za-z0-9_-]/g, ''),
    googleRating: str(s.googleRating, 4).replace(/[^0-9.]/g, ''),
    googleReviewCount: str(s.googleReviewCount, 6).replace(/[^0-9]/g, ''),
    showReviews: s.showReviews !== false,
    featuredReviews: list(s.featuredReviews, 12, (r) => ({
      author: str(r?.author, 80),
      rating: String(Math.min(5, Math.max(1, Math.round(Number(r?.rating) || 5)))),
      when: str(r?.when, 40),
      text: str(r?.text, 3000),
    })).filter((r) => r.text || r.author),
    hours: list(s.hours, 10, (h) => ({ days: str(h?.days, 60), time: str(h?.time, 60) })),
    storyTitle: str(s.storyTitle, LIMITS.short),
    storyBody: str(s.storyBody, LIMITS.long),
    storyPhotoId: str(s.storyPhotoId, 64),
    providersTitle: str(s.providersTitle, LIMITS.short),
    providersIntro: str(s.providersIntro, LIMITS.medium),
    providers: list(s.providers, 12, (p) => ({
      name: str(p?.name, 80),
      role: str(p?.role, 80),
      photoId: str(p?.photoId, 64),
      bio: str(p?.bio, 1500),
    })),
    highlights: list(s.highlights, 6, (h) => ({ title: str(h?.title, 60), text: str(h?.text, 200) })),
    schedule: list(s.schedule, 20, (i) => ({
      time: str(i?.time, 20),
      activity: str(i?.activity, 80),
      detail: str(i?.detail, 200),
    })),
    faqs: list(s.faqs, 30, (f) => ({ q: str(f?.q, 200), a: str(f?.a, 2000) })),
    contactIntro: str(s.contactIntro, LIMITS.medium),
  };
}
