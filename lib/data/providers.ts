import type { NewProvider } from '@/lib/db/schema';

export const syntheticProviders: NewProvider[] = [
  {
    id: 'prov-001',
    npi: '1548293761',
    name: 'Dr. Elena Ramirez, MD',
    specialty: 'Orthopedic Surgery',
    organization: 'Meridian Orthopedic Associates',
  },
  {
    id: 'prov-002',
    npi: '1927384561',
    name: 'Dr. Marcus Chen, MD',
    specialty: 'Cardiology',
    organization: 'Meridian Heart Center',
  },
  {
    id: 'prov-003',
    npi: '1364728193',
    name: 'Dr. Aisha Patel, MD',
    specialty: 'Neurology',
    organization: 'Meridian Neuroscience Institute',
  },
  {
    id: 'prov-004',
    npi: '1836492758',
    name: 'Dr. James Okonkwo, MD',
    specialty: 'Oncology',
    organization: 'Meridian Cancer Center',
  },
  {
    id: 'prov-005',
    npi: '1729384756',
    name: 'Dr. Sarah Klein, DO',
    specialty: 'Pain Management',
    organization: 'Meridian Pain & Spine',
  },
  {
    id: 'prov-006',
    npi: '1648293751',
    name: 'Dr. Raj Gupta, MD',
    specialty: 'Gastroenterology',
    organization: 'Meridian GI Associates',
  },
];
