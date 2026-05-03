// CV Genie - Data Constants
// Colors, templates, font pairs, summary templates, skill categories

const COLORS = [
  '#2563eb', '#059669', '#dc2626', '#7c3aed',
  '#ea580c', '#0891b2', '#be185d', '#1e293b'
];

const TEMPLATES = [
  'classic', 'modern', 'tabular', 'minimal', 'colorful',
  'executive', 'timeline', 'newspaper', 'magazine', 'infographic',
  'creative', 'sidebar-bold', 'corporate'
];

const TEMPLATE_META = {
  classic: { name: 'Classic', icon: '🏛️', desc: 'Traditional serif' },
  modern: { name: 'Modern', icon: '✨', desc: 'Clean with color' },
  tabular: { name: 'Tabular', icon: '📊', desc: 'Table format' },
  minimal: { name: 'Minimal', icon: '◻️', desc: 'Light & elegant' },
  colorful: { name: 'Colorful', icon: '🎨', desc: 'Bold gradient' },
  executive: { name: 'Executive', icon: '💼', desc: 'Boardroom' },
  timeline: { name: 'Timeline', icon: '📅', desc: 'Career visual' },
  newspaper: { name: 'Newspaper', icon: '📰', desc: 'Two-column' },
  magazine: { name: 'Magazine', icon: '📖', desc: 'Editorial' },
  infographic: { name: 'Infographic', icon: '📈', desc: 'Data cards' },
  creative: { name: 'Creative', icon: '🎯', desc: 'Tag-based' },
  'sidebar-bold': { name: 'Sidebar Bold', icon: '📌', desc: 'Color sidebar' },
  corporate: { name: 'Corporate', icon: '🏢', desc: 'Blue corporate' }
};

const FONT_PAIRS = [
  { name: 'Classic Serif', heading: 'Georgia, serif', body: 'Georgia, serif' },
  { name: 'Modern Sans', heading: 'Inter, sans-serif', body: 'Inter, sans-serif' },
  { name: 'Roboto + Lora', heading: 'Roboto, sans-serif', body: 'Lora, serif' },
  { name: 'Montserrat + Merriweather', heading: 'Montserrat, sans-serif', body: 'Merriweather, serif' },
  { name: 'Playfair + Source', heading: 'Playfair Display, serif', body: 'Source Serif 4, serif' },
  { name: 'Poppins + Inter', heading: 'Poppins, sans-serif', body: 'Inter, sans-serif' }
];

const SUMMARY_TEMPLATES = [
  { label: 'Software Engineer', text: 'Results-driven Software Engineer with 5+ years of experience designing and implementing scalable applications.' },
  { label: 'Product Manager', text: 'Strategic Product Manager with a track record of launching successful B2B and B2C products.' },
  { label: 'Data Scientist', text: 'Analytical Data Scientist with expertise in machine learning and statistical modeling.' },
  { label: 'UX Designer', text: 'User-centered UX Designer creating intuitive and accessible digital experiences.' },
  { label: 'Marketing Manager', text: 'Innovative Marketing Manager with expertise in digital strategy and brand development.' },
  { label: 'Project Manager', text: 'Certified Project Manager with extensive experience leading complex initiatives.' },
  { label: 'Sales Executive', text: 'Top-performing Sales Executive with a consistent record of exceeding revenue targets.' },
  { label: 'Teacher/Educator', text: 'Dedicated Educator fostering inclusive learning environments.' },
  { label: 'Nurse/Healthcare', text: 'Compassionate Registered Nurse with acute care and patient advocacy experience.' },
  { label: 'Accountant', text: 'Detail-oriented Accountant with expertise in financial reporting and audit support.' },
  { label: 'Construction Manager', text: 'Experienced Construction Manager delivering projects on time and under budget.' },
  { label: 'HR Professional', text: 'Strategic HR Professional skilled in talent acquisition and development.' },
  { label: 'Consultant', text: 'Results-oriented Consultant delivering high-impact solutions for clients.' },
  { label: 'Entrepreneur', text: 'Serial Entrepreneur experienced in founding and scaling ventures.' },
  { label: 'Recent Graduate', text: 'Motivated recent graduate with strong academic foundation and internship experience.' }
];

const SKILL_CATEGORIES = {
  tech: [
    'JavaScript', 'Python', 'React', 'Node.js', 'AWS', 'Docker',
    'Kubernetes', 'TypeScript', 'SQL', 'MongoDB', 'Git', 'REST API',
    'GraphQL', 'DevOps', 'CI/CD'
  ],
  business: [
    'Project Management', 'Strategic Planning', 'Stakeholder Management',
    'Budgeting', 'Risk Management', 'Operations'
  ],
  creative: [
    'Figma', 'Adobe Creative Suite', 'UI/UX Design',
    'Wireframing', 'Prototyping', 'Typography'
  ],
  construction: [
    'Blueprint Reading', 'OSHA Safety', 'Heavy Equipment', 'Carpentry',
    'Electrical', 'Plumbing', 'HVAC', 'Welding'
  ],
  healthcare: [
    'Patient Care', 'Clinical Assessment', 'HIPAA Compliance',
    'EHR Management', 'Medication Administration'
  ],
  finance: [
    'Financial Analysis', 'Forecasting', 'QuickBooks', 'Excel',
    'SAP', 'Risk Assessment', 'Auditing'
  ],
  marketing: [
    'SEO/SEM', 'Content Strategy', 'Social Media', 'Email Marketing',
    'Google Analytics', 'PPC', 'CRM'
  ],
  education: [
    'Curriculum Design', 'Classroom Management', 'Lesson Planning',
    'Student Assessment', 'E-Learning'
  ]
};

const PDF_SERVER_URL = 'https://cv-genie-server.onrender.com/export-pdf';
const DOCX_SERVER_URL = 'https://cv-genie-server.onrender.com/export-docx';

const A4_WIDTH = 794;