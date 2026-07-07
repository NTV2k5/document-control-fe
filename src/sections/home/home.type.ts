export interface IHomeSectionProps {
  data?: Record<string, unknown>[];
}

export interface IHomeSectionService {
  id: string;
  title: string;
  icon: string;
  description: string;
}

export interface IHomeSectionCategory {
  id: string;
  title: string;
  services: IHomeSectionService[];
}

export type HomeSectionProps = IHomeSectionProps;
export type HomeSectionService = IHomeSectionService;
export type HomeSectionCategory = IHomeSectionCategory;

export const HOME_SECTION_CATEGORIES: IHomeSectionCategory[] = [
  {
    id: 'home-design',
    title: 'Home Design & Renovation',
    services: [
      {
        id: 'architect',
        title: 'Architect',
        icon: '🏗️',
        description: 'Professional architectural services',
      },
      {
        id: 'interior-design',
        title: 'Bespoke Interior Design',
        icon: '🎨',
        description: 'Custom interior design solutions',
      },
      {
        id: 'kitchen-design',
        title: 'Kitchen Design',
        icon: '🍳',
        description: 'Specialized kitchen design services',
      },
      {
        id: 'bathroom-design',
        title: 'Bathroom Design',
        icon: '🚿',
        description: 'Custom bathroom solutions',
      },
      {
        id: 'landscaping',
        title: 'Landscaping',
        icon: '🌳',
        description: 'Garden and outdoor design',
      },
      {
        id: 'lighting',
        title: 'Lighting Design',
        icon: '💡',
        description: 'Custom lighting solutions',
      },
      {
        id: 'flooring',
        title: 'Flooring Solutions',
        icon: '🏢',
        description: 'Professional flooring services',
      },
      {
        id: 'windows',
        title: 'Windows & Doors',
        icon: '🪟',
        description: 'Custom windows and doors',
      },
      {
        id: 'painting',
        title: 'Painting & Decoration',
        icon: '🎨',
        description: 'Professional painting services',
      },
      {
        id: 'storage',
        title: 'Storage Solutions',
        icon: '📦',
        description: 'Custom storage design',
      },
      {
        id: 'smart-home',
        title: 'Smart Home Integration',
        icon: '🏠',
        description: 'Home automation services',
      },
      {
        id: 'furniture',
        title: 'Furniture Design',
        icon: '🪑',
        description: 'Custom furniture solutions',
      },
      {
        id: 'home-automation',
        title: 'Home Automation',
        icon: '🤖',
        description: 'Smart home automation solutions',
      },
      {
        id: 'security-systems',
        title: 'Security Systems',
        icon: '🔒',
        description: 'Home security solutions',
      },
      {
        id: 'audio-visual',
        title: 'Audio Visual',
        icon: '🎵',
        description: 'Home entertainment systems',
      },
      {
        id: 'wine-cellars',
        title: 'Wine Cellars',
        icon: '🍷',
        description: 'Custom wine storage solutions',
      },
      {
        id: 'home-theater',
        title: 'Home Theater',
        icon: '🎬',
        description: 'Custom home cinema rooms',
      },
      {
        id: 'gym-design',
        title: 'Gym Design',
        icon: '💪',
        description: 'Home gym solutions',
      },
      {
        id: 'spa-design',
        title: 'Spa Design',
        icon: '💆',
        description: 'Home spa and wellness',
      },
      {
        id: 'art-curation',
        title: 'Art Curation',
        icon: '🎨',
        description: 'Art selection and placement',
      },
      {
        id: 'outdoor-kitchen',
        title: 'Outdoor Kitchen',
        icon: '🏡',
        description: 'Outdoor cooking spaces',
      },
      {
        id: 'pool-design',
        title: 'Pool Design',
        icon: '🏊',
        description: 'Swimming pool solutions',
      },
      {
        id: 'smart-lighting',
        title: 'Smart Lighting',
        icon: '💡',
        description: 'Automated lighting systems',
      },
      {
        id: 'home-office',
        title: 'Home Office',
        icon: '💼',
        description: 'Professional workspace design',
      },
    ],
  },
  {
    id: 'maintenance',
    title: 'Maintenance',
    services: [
      {
        id: 'general-maintenance',
        title: 'General Maintenance',
        icon: '🔧',
        description: 'Regular property maintenance',
      },
      {
        id: 'plumbing',
        title: 'Plumbing Services',
        icon: '🚰',
        description: 'Professional plumbing solutions',
      },
      {
        id: 'electrical',
        title: 'Electrical Services',
        icon: '⚡',
        description: 'Electrical maintenance and installation',
      },
    ],
  },
  {
    id: 'property-management',
    title: 'Property Management',
    services: [
      {
        id: 'rental',
        title: 'Rental Management',
        icon: '🏢',
        description: 'Complete rental property management',
      },
    ],
  },
  {
    id: 'interior-solutions',
    title: 'Interior Solutions',
    services: [
      {
        id: 'space-planning',
        title: 'Space Planning',
        icon: '📐',
        description: 'Optimal space utilization',
      },
    ],
  },
  {
    id: 'construction',
    title: 'Construction Services',
    services: [
      {
        id: 'renovation',
        title: 'Renovation',
        icon: '🏗️',
        description: 'Complete renovation services',
      },
    ],
  },
  {
    id: 'outdoor',
    title: 'Outdoor Services',
    services: [
      {
        id: 'garden',
        title: 'Garden Design',
        icon: '🌺',
        description: 'Professional garden design',
      },
    ],
  },
];

export const PARTNERS = [
  {
    id: 'interior-design-mag',
    name: 'Interior Design Magazine',
    logo: 'https://portal-biz-dev.aurora-tech.com/assets/interior-design-partner-142x142.png', // Using the provided image URL,
    services: [
      { name: 'Service name here 1', price: 250 },
      { name: 'Service name here 2', price: 250 },
      { name: 'Service name here 3', price: 250 },
    ],
    contacts: [
      {
        name: 'Mandy Sam',
        role: 'Primary contact',
        email: 'mandy.sam@interioedesign.com',
        phone: '+44 12310 15135',
      },
      {
        name: 'John Simpson',
        role: 'Other contact',
        email: 'john.simpson@interioedesign.com',
        phone: '+44 12310 15135',
      },
    ],
  },
  {
    id: 'itwr',
    name: 'In The White Room',
    logo: 'https://portal-biz-dev.aurora-tech.com/assets/interior-design-partner-142x142.png', // Using the provided image URL,
    services: [
      { name: 'Service name here 1', price: 250 },
      { name: 'Service name here 2', price: 250 },
      { name: 'Service name here 3', price: 250 },
    ],
    contacts: [
      {
        name: 'Mandy Sam',
        role: 'Primary contact',
        email: 'mandy.sam@interioedesign.com',
        phone: '+44 12310 15135',
      },
      {
        name: 'John Simpson',
        role: 'Other contact',
        email: 'john.simpson@interioedesign.com',
        phone: '+44 12310 15135',
      },
    ],
  },
  {
    id: 'iodai',
    name: 'IODAI Luxury Furniture',
    logo: 'https://portal-biz-dev.aurora-tech.com/assets/interior-design-partner-142x142.png', // Using the provided image URL,
    services: [
      { name: 'Service name here 1', price: 250 },
      { name: 'Service name here 2', price: 250 },
      { name: 'Service name here 3', price: 250 },
    ],
    contacts: [
      {
        name: 'Mandy Sam',
        role: 'Primary contact',
        email: 'mandy.sam@interioedesign.com',
        phone: '+44 12310 15135',
      },
      {
        name: 'John Simpson',
        role: 'Other contact',
        email: 'john.simpson@interioedesign.com',
        phone: '+44 12310 15135',
      },
    ],
  },
  {
    id: 'period-home',
    name: 'Period Home & Interiors',
    logo: 'https://portal-biz-dev.aurora-tech.com/assets/interior-design-partner-142x142.png', // Using the provided image URL,
    services: [
      { name: 'Service name here', price: 250 },
      { name: 'Service name here', price: 250 },
      { name: 'Service name here', price: 250 },
    ],
    contacts: [
      {
        name: 'Mandy Sam',
        role: 'Primary contact',
        email: 'mandy.sam@interioedesign.com',
        phone: '+44 12310 15135',
      },
      {
        name: 'John Simpson',
        role: 'Other contact',
        email: 'john.simpson@interioedesign.com',
        phone: '+44 12310 15135',
      },
    ],
  },
];
