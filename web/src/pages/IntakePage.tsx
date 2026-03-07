import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Check,
  FileText,
  Globe,
  GraduationCap,
  Landmark,
  MapPinned,
  Settings,
  Sparkles,
  Upload,
  User,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { SearchType } from '../types';
import { useAuth } from '../auth/AuthContext';
import {
  JobSearchIntakeData,
  PersistedSearchSession,
  SearchIntakeData,
  writePersistedSearchSession,
} from '../services/searchSessionStore';

type SearchOptionId = SearchType.JOB | SearchType.SCHOLARSHIP | SearchType.VISA;
type StepId =
  | 'roles'
  | 'location'
  | 'experience'
  | 'documents'
  | 'preferences'
  | 'focus'
  | 'destination'
  | 'profile'
  | 'country'
  | 'path'
  | 'review';

type IntakeFormData = {
  searchType: SearchOptionId;
  roles: string[];
  location: string;
  remote: boolean;
  experience: 'Entry' | 'Mid' | 'Senior';
  years: string;
  industry: string;
  salary: string;
  visaSponsorship: boolean;
  cv: File | null;
  scholarshipQuery: string;
  studyLevel: '' | 'Undergraduate' | 'Masters' | 'PhD' | 'Professional';
  destinationRegion: string;
  fundingType: '' | 'Full funding' | 'Partial funding' | 'Tuition only' | 'Any funding';
  intakeTerm: string;
  academicBackground: string;
  scholarshipDocument: File | null;
  visaCountry: string;
  visaCategory: '' | 'Work visa' | 'Student visa' | 'Skilled migration' | 'Digital nomad visa' | 'Tourist visa';
  nationality: string;
  currentResidence: string;
  travelReason: string;
  visaTimeline: string;
  visaDocument: File | null;
};

type IntakeLocationState = {
  prefill?: SearchIntakeData;
  reusedFromSessionId?: string;
  resumeAtReview?: boolean;
};

type StepConfig = {
  id: StepId;
  title: string;
  icon: React.ComponentType<{ size?: number }>;
};

const roleSuggestions = [
  'Backend Engineer',
  'Full Stack Developer',
  'Product Manager',
  'Operations Analyst',
  'Customer Success Specialist',
  'Business Analyst',
  'Communication',
  'Leadership',
  'Problem Solving',
  'Teamwork',
];

const locationOptions = [
  { value: '', label: 'Select a location' },
  { value: 'Any location', label: 'Any location (all of the above)' },
  { value: 'Germany', label: 'Germany' },
  { value: 'United Kingdom', label: 'United Kingdom' },
  { value: 'Canada', label: 'Canada' },
  { value: 'United States', label: 'United States' },
  { value: 'Netherlands', label: 'Netherlands' },
];

const scholarshipDestinationOptions = [
  { value: '', label: 'Select destination scope' },
  { value: 'Europe', label: 'Europe' },
  { value: 'United Kingdom', label: 'United Kingdom' },
  { value: 'North America', label: 'North America' },
  { value: 'Middle East', label: 'Middle East' },
  { value: 'Any region', label: 'Any region' },
];

const visaCountryOptions = [
  { value: '', label: 'Select a target country' },
  { value: 'Canada', label: 'Canada' },
  { value: 'Germany', label: 'Germany' },
  { value: 'United Kingdom', label: 'United Kingdom' },
  { value: 'Netherlands', label: 'Netherlands' },
  { value: 'United Arab Emirates', label: 'United Arab Emirates' },
];

const industrySuggestions = ['FinTech', 'HealthTech', 'EdTech', 'AI/ML', 'SaaS', 'E-commerce'];
const salarySuggestions = ['$60,000', '$80,000', '$100,000', '$120,000+'];
const intakeTermSuggestions = ['Fall 2026', 'Spring 2027', 'Rolling admissions', 'Next available'];
const visaTimelineSuggestions = ['Immediately', 'Within 3 months', 'Within 6 months', 'Planning ahead'];

const stepsByType: Record<SearchType, StepConfig[]> = {
  [SearchType.JOB]: [
    { id: 'roles', title: 'Roles', icon: User },
    { id: 'location', title: 'Location', icon: Globe },
    { id: 'experience', title: 'Experience', icon: Briefcase },
    { id: 'documents', title: 'Documents', icon: FileText },
    { id: 'preferences', title: 'Preferences', icon: Settings },
    { id: 'review', title: 'Review', icon: Check },
  ],
  [SearchType.SCHOLARSHIP]: [
    { id: 'focus', title: 'Study Goal', icon: GraduationCap },
    { id: 'destination', title: 'Destination', icon: MapPinned },
    { id: 'profile', title: 'Profile', icon: User },
    { id: 'documents', title: 'Documents', icon: FileText },
    { id: 'preferences', title: 'Preferences', icon: Settings },
    { id: 'review', title: 'Review', icon: Check },
  ],
  [SearchType.VISA]: [
    { id: 'country', title: 'Country', icon: Landmark },
    { id: 'path', title: 'Visa Path', icon: FileText },
    { id: 'profile', title: 'Profile', icon: User },
    { id: 'documents', title: 'Documents', icon: FileText },
    { id: 'preferences', title: 'Preferences', icon: Settings },
    { id: 'review', title: 'Review', icon: Check },
  ],
};

function normalizeType(input?: string): SearchOptionId | undefined {
  if (input === SearchType.JOB || input === SearchType.SCHOLARSHIP || input === SearchType.VISA) {
    return input;
  }
  return undefined;
}

function getSearchTypeLabel(type: SearchOptionId): string {
  if (type === SearchType.SCHOLARSHIP) return 'Scholarships';
  if (type === SearchType.VISA) return 'Visa Requirements';
  return 'Jobs';
}

function buildIntakeFormData(searchType: SearchOptionId, prefill?: SearchIntakeData): IntakeFormData {
  return {
    searchType,
    roles: Array.isArray(prefill?.roles) ? [...prefill.roles] : [],
    location: prefill?.location || '',
    remote: Boolean(prefill?.remote),
    experience: prefill?.experience || 'Entry',
    years: prefill?.years || '',
    industry: prefill?.industry || '',
    salary: prefill?.salary || '',
    visaSponsorship: Boolean(prefill?.visaSponsorship),
    cv: null,
    scholarshipQuery: prefill?.scholarshipQuery || '',
    studyLevel: prefill?.studyLevel || '',
    destinationRegion: prefill?.destinationRegion || '',
    fundingType: prefill?.fundingType || '',
    intakeTerm: prefill?.intakeTerm || '',
    academicBackground: prefill?.academicBackground || '',
    scholarshipDocument: null,
    visaCountry: prefill?.visaCountry || '',
    visaCategory: prefill?.visaCategory || '',
    nationality: prefill?.nationality || '',
    currentResidence: prefill?.currentResidence || '',
    travelReason: prefill?.travelReason || '',
    visaTimeline: prefill?.visaTimeline || '',
    visaDocument: null,
  };
}

function getPrefillStep(formData: IntakeFormData): number {
  const yearsNumber = Number(formData.years);
  const isYearsValid = formData.years.trim() !== '' && Number.isFinite(yearsNumber) && yearsNumber >= 1;

  if (formData.searchType === SearchType.SCHOLARSHIP) {
    if (!formData.scholarshipQuery.trim()) return 0;
    if (!formData.destinationRegion.trim()) return 1;
    if (!formData.studyLevel || !formData.academicBackground.trim()) return 2;
    return 3;
  }

  if (formData.searchType === SearchType.VISA) {
    if (!formData.visaCountry.trim()) return 0;
    if (!formData.visaCategory) return 1;
    if (!formData.nationality.trim() || !formData.travelReason.trim()) return 2;
    return 3;
  }

  if (!formData.roles.length) return 0;
  if (!formData.location) return 1;
  if (!isYearsValid) return 2;
  return 3;
}

function toPersistableFormData(formData: IntakeFormData): JobSearchIntakeData {
  return {
    searchType: formData.searchType,
    roles: [...formData.roles],
    location: formData.location,
    remote: formData.remote,
    experience: formData.experience,
    years: formData.years,
    industry: formData.industry,
    salary: formData.salary,
    visaSponsorship: formData.visaSponsorship,
    scholarshipQuery: formData.scholarshipQuery,
    studyLevel: formData.studyLevel || undefined,
    destinationRegion: formData.destinationRegion,
    fundingType: formData.fundingType || undefined,
    intakeTerm: formData.intakeTerm,
    academicBackground: formData.academicBackground,
    scholarshipDocumentName: formData.scholarshipDocument?.name || null,
    visaCountry: formData.visaCountry,
    visaCategory: formData.visaCategory || undefined,
    nationality: formData.nationality,
    currentResidence: formData.currentResidence,
    travelReason: formData.travelReason,
    visaTimeline: formData.visaTimeline,
    visaDocumentName: formData.visaDocument?.name || null,
  };
}

export function IntakePage() {
  const { type } = useParams<{ type?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { authUser } = useAuth();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const scholarshipFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const visaFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const routeState = (location.state || {}) as IntakeLocationState;
  const authUserId = String(authUser?.userId || '').trim();

  const normalizedType = normalizeType(type);
  const activeType = normalizedType || SearchType.JOB;
  const steps = React.useMemo(() => stepsByType[activeType], [activeType]);
  const initialFormData = React.useMemo(() => buildIntakeFormData(activeType, routeState.prefill), [activeType, routeState.prefill]);

  const [currentStep, setCurrentStep] = React.useState(() => (routeState.resumeAtReview ? steps.length - 1 : getPrefillStep(initialFormData)));
  const [tagInput, setTagInput] = React.useState('');
  const [formData, setFormData] = React.useState<IntakeFormData>(initialFormData);
  const [reusedFromSessionId, setReusedFromSessionId] = React.useState<string | null>(routeState.reusedFromSessionId || null);
  const [submittedSession, setSubmittedSession] = React.useState<{ sessionId: string; type: SearchType } | null>(null);

  React.useEffect(() => {
    if (!normalizedType) {
      navigate('/new-search', { replace: true });
    }
  }, [navigate, normalizedType]);

  React.useEffect(() => {
    const nextFormData = buildIntakeFormData(activeType, routeState.prefill);
    setFormData(nextFormData);
    setCurrentStep(routeState.resumeAtReview ? steps.length - 1 : getPrefillStep(nextFormData));
    setTagInput('');
    setReusedFromSessionId(routeState.reusedFromSessionId || null);
    setSubmittedSession(null);
  }, [activeType, routeState.prefill, routeState.resumeAtReview, routeState.reusedFromSessionId, steps.length]);

  const yearsNumber = Number(formData.years);
  const isYearsValid = formData.years.trim() !== '' && Number.isFinite(yearsNumber) && yearsNumber >= 1;

  const getStepError = React.useCallback(
    (stepIndex: number) => {
      const step = steps[stepIndex];
      if (!step) return '';

      if (formData.searchType === SearchType.SCHOLARSHIP) {
        switch (step.id) {
          case 'focus':
            return formData.scholarshipQuery.trim() ? '' : 'Add the scholarship or study focus you want to search for.';
          case 'destination':
            return formData.destinationRegion.trim() ? '' : 'Choose a destination region or country target.';
          case 'profile':
            return formData.studyLevel && formData.academicBackground.trim()
              ? ''
              : 'Select a study level and describe your academic background.';
          case 'review':
            return formData.scholarshipQuery.trim() && formData.destinationRegion.trim() && formData.studyLevel && formData.academicBackground.trim()
              ? ''
              : 'Required scholarship criteria is incomplete. Go back and finish the missing steps.';
          default:
            return '';
        }
      }

      if (formData.searchType === SearchType.VISA) {
        switch (step.id) {
          case 'country':
            return formData.visaCountry.trim() ? '' : 'Select the country you need visa guidance for.';
          case 'path':
            return formData.visaCategory ? '' : 'Choose the visa path you want to research.';
          case 'profile':
            return formData.nationality.trim() && formData.travelReason.trim()
              ? ''
              : 'Add your nationality and travel reason to continue.';
          case 'review':
            return formData.visaCountry.trim() && formData.visaCategory && formData.nationality.trim() && formData.travelReason.trim()
              ? ''
              : 'Required visa criteria is incomplete. Go back and finish the missing steps.';
          default:
            return '';
        }
      }

      switch (step.id) {
        case 'roles':
          return formData.roles.length > 0 ? '' : 'Add at least one target role to continue.';
        case 'location':
          return formData.location ? '' : 'Select a location option to continue.';
        case 'experience':
          return isYearsValid ? '' : 'Enter your years of experience (minimum 1) to continue.';
        case 'review':
          return formData.roles.length > 0 && formData.location && isYearsValid
            ? ''
            : 'Required search criteria is incomplete. Go back and complete missing steps.';
        default:
          return '';
      }
    },
    [formData, isYearsValid, steps],
  );

  const isStepValid = React.useCallback((stepIndex: number) => getStepError(stepIndex) === '', [getStepError]);
  const isCurrentStepValid = isStepValid(currentStep);
  const currentStepError = getStepError(currentStep);

  const isStepAccessible = React.useCallback(
    (stepIndex: number) => {
      if (stepIndex <= currentStep) return true;
      for (let idx = 0; idx < stepIndex; idx += 1) {
        if (!isStepValid(idx)) return false;
      }
      return true;
    },
    [currentStep, isStepValid],
  );

  const updateFormData = <K extends keyof IntakeFormData>(key: K, value: IntakeFormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const addRole = (rawRole: string) => {
    const role = rawRole.trim();
    if (!role) return;
    const exists = formData.roles.some((item) => item.toLowerCase() === role.toLowerCase());
    if (exists) {
      setTagInput('');
      return;
    }
    updateFormData('roles', [...formData.roles, role]);
    setTagInput('');
  };

  const removeRole = (role: string) => {
    updateFormData(
      'roles',
      formData.roles.filter((item) => item !== role),
    );
  };

  const handleResetPrefill = () => {
    const blankForm = buildIntakeFormData(activeType);
    setFormData(blankForm);
    setCurrentStep(0);
    setTagInput('');
    setReusedFromSessionId(null);
    setSubmittedSession(null);
  };

  const persistNonJobSearch = React.useCallback(() => {
    if (!authUserId) return;
    const sessionId = Math.random().toString(36).substring(7);
    const payload: PersistedSearchSession = {
      version: 1,
      sessionId,
      type: formData.searchType,
      formData: toPersistableFormData(formData),
      status: 'completed',
      searchPhase: 'completed',
      elapsedTime: 0,
      timeline: [],
      results: [],
      activeTab: 'all',
      runId: null,
      cache: null,
      startedAt: Date.now(),
      lastSequence: 0,
      updatedAt: Date.now(),
    };
    writePersistedSearchSession(authUserId, payload);
    setSubmittedSession({ sessionId, type: formData.searchType });
  }, [authUserId, formData]);

  const handleNext = () => {
    if (!isCurrentStepValid) return;

    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
      return;
    }

    if (formData.searchType === SearchType.JOB) {
      const sessionId = Math.random().toString(36).substring(7);
      navigate(`/session/${sessionId}`, {
        state: {
          type: formData.searchType,
          formData: toPersistableFormData(formData),
        },
      });
      return;
    }

    persistNonJobSearch();
  };

  const handleBack = () => {
    if (submittedSession) {
      setSubmittedSession(null);
      setCurrentStep(steps.length - 1);
      return;
    }

    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
      return;
    }

    navigate('/new-search');
  };

  const renderDocumentNotice = (file: File | null, onClear: () => void, accent: 'emerald' | 'sky') => {
    if (!file) return null;

    const colorClass =
      accent === 'emerald'
        ? 'mt-6 rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-900'
        : 'mt-6 rounded-xl border border-sky-100 bg-sky-50 text-sky-900';

    return (
      <div className={`${colorClass} flex items-center justify-between gap-3 p-4`}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/80">
            <FileText size={20} />
          </div>
          <div>
            <p className="font-bold">{file.name}</p>
            <p className="text-xs opacity-80">File name captured for this criteria flow.</p>
          </div>
        </div>
        <button type="button" onClick={onClear} className="opacity-60 transition-all hover:opacity-100">
          <X size={18} />
        </button>
      </div>
    );
  };

  const renderReviewCards = () => {
    if (formData.searchType === SearchType.SCHOLARSHIP) {
      return [
        { label: 'Search Type', value: 'Scholarships', step: 0 },
        { label: 'Focus', value: formData.scholarshipQuery || 'Not set', step: 0 },
        { label: 'Destination', value: formData.destinationRegion || 'Not set', step: 1 },
        { label: 'Study Level', value: formData.studyLevel || 'Not set', step: 2 },
        { label: 'Academic Background', value: formData.academicBackground || 'Not set', step: 2 },
        { label: 'Funding Preference', value: formData.fundingType || 'Any funding', step: 4 },
        { label: 'Target Intake', value: formData.intakeTerm || 'Flexible', step: 4 },
      ];
    }

    if (formData.searchType === SearchType.VISA) {
      return [
        { label: 'Search Type', value: 'Visa Requirements', step: 0 },
        { label: 'Target Country', value: formData.visaCountry || 'Not set', step: 0 },
        { label: 'Visa Category', value: formData.visaCategory || 'Not set', step: 1 },
        { label: 'Nationality', value: formData.nationality || 'Not set', step: 2 },
        { label: 'Current Residence', value: formData.currentResidence || 'Not set', step: 2 },
        { label: 'Travel Reason', value: formData.travelReason || 'Not set', step: 2 },
        { label: 'Timeline', value: formData.visaTimeline || 'Flexible', step: 4 },
      ];
    }

    return [
      { label: 'Search Type', value: 'Jobs', step: 0 },
      { label: 'Roles', value: formData.roles.join(', ') || 'None specified', step: 0 },
      { label: 'Location', value: `${formData.location || 'Not selected'}${formData.remote ? ' (Remote included)' : ''}`, step: 1 },
      { label: 'Experience', value: `${formData.experience}${formData.years ? ` (${formData.years} years)` : ''}`, step: 2 },
      { label: 'CV', value: formData.cv ? formData.cv.name : 'Skipped', step: 3 },
      { label: 'Industry', value: formData.industry || 'Any', step: 4 },
      { label: 'Salary', value: formData.salary || 'Not specified', step: 4 },
      { label: 'Sponsorship', value: formData.visaSponsorship ? 'Required' : 'Not required', step: 4 },
    ];
  };

  const renderStepContent = () => {
    const stepId = steps[currentStep]?.id;

    switch (stepId) {
      case 'roles':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-[28px] font-bold mb-2">What roles are you targeting?</h2>
              <p className="text-neutral-500 mb-8">Add one or more job titles or keywords to shape your search.</p>

              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addRole(tagInput);
                      }
                    }}
                    placeholder="e.g. Backend Engineer, Product Manager, Communication"
                    className="w-full sm:flex-1 px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => addRole(tagInput)}
                    className="w-full sm:w-auto px-8 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-black transition-all active:scale-95"
                  >
                    Add
                  </button>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-widest font-bold text-neutral-400 mb-2">Quick options</p>
                  <div className="flex flex-wrap gap-2">
                    {roleSuggestions.map((role) => {
                      const selected = formData.roles.includes(role);
                      return (
                        <button
                          key={role}
                          type="button"
                          onClick={() => addRole(role)}
                          className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                            selected ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400'
                          }`}
                        >
                          {role}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {formData.roles.map((role) => (
                    <span
                      key={role}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-neutral-100 text-neutral-900 rounded-lg text-sm font-medium border border-neutral-200"
                    >
                      {role}
                      <button type="button" onClick={() => removeRole(role)} className="hover:text-black">
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 'location':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-[28px] font-bold mb-2">Where would you like to work?</h2>
              <p className="text-neutral-500 mb-8">Select one location target to drive this search session.</p>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold mb-2 uppercase tracking-wider text-neutral-400">Target location</label>
                  <select
                    value={formData.location}
                    onChange={(event) => updateFormData('location', event.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all bg-white"
                  >
                    {locationOptions.map((option) => (
                      <option key={option.label} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-neutral-500">Use “Any location” if you do not want to limit this search by country.</p>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl border border-neutral-200 bg-white">
                  <div>
                    <h4 className="font-bold">Include remote opportunities</h4>
                    <p className="text-sm text-neutral-500">Add roles that support remote or distributed work.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateFormData('remote', !formData.remote)}
                    className={`w-12 h-6 rounded-full transition-all relative ${formData.remote ? 'bg-neutral-900' : 'bg-neutral-200'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${formData.remote ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'experience':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-[28px] font-bold mb-2">What’s your experience level?</h2>
              <p className="text-neutral-500 mb-8">This helps match job seniority and role scope.</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {['Entry', 'Mid', 'Senior'].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => updateFormData('experience', level as IntakeFormData['experience'])}
                    className={`p-6 rounded-xl border-2 text-center transition-all ${
                      formData.experience === level
                        ? 'border-neutral-900 bg-neutral-100 text-neutral-900 font-bold'
                        : 'border-neutral-100 bg-white text-neutral-500 hover:border-neutral-200'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 uppercase tracking-wider text-neutral-400">Years of experience</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={formData.years}
                  onChange={(event) => updateFormData('years', event.target.value)}
                  placeholder="e.g. 5"
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all"
                />
                <p className="mt-2 text-xs text-neutral-500">This field is required. Enter a whole number (minimum 1).</p>
              </div>
            </div>
          </div>
        );

      case 'focus':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-[28px] font-bold mb-2">What scholarship are you targeting?</h2>
              <p className="text-neutral-500 mb-8">Describe the course, program, or opportunity focus you want to search for.</p>

              <label className="block text-sm font-semibold mb-2 uppercase tracking-wider text-neutral-400">Study focus</label>
              <input
                type="text"
                value={formData.scholarshipQuery}
                onChange={(event) => updateFormData('scholarshipQuery', event.target.value)}
                placeholder="e.g. MSc Data Science, public health scholarship, fully funded MBA"
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all"
              />
              <p className="mt-2 text-xs text-neutral-500">Use the exact program or scholarship theme you care about most.</p>
            </div>
          </div>
        );

      case 'destination':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-[28px] font-bold mb-2">Where do you want to study?</h2>
              <p className="text-neutral-500 mb-8">Set the destination market so results match your preferred regions or countries.</p>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-semibold mb-2 uppercase tracking-wider text-neutral-400">Destination preference</label>
                  <select
                    value={formData.destinationRegion}
                    onChange={(event) => updateFormData('destinationRegion', event.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all bg-white"
                  >
                    {scholarshipDestinationOptions.map((option) => (
                      <option key={option.label} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2 uppercase tracking-wider text-neutral-400">Target intake</label>
                  <input
                    type="text"
                    value={formData.intakeTerm}
                    onChange={(event) => updateFormData('intakeTerm', event.target.value)}
                    placeholder="e.g. Fall 2026"
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {intakeTermSuggestions.map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => updateFormData('intakeTerm', term)}
                        className="px-2.5 py-1 rounded-md text-xs border border-neutral-200 text-neutral-600 hover:border-neutral-400"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'country':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-[28px] font-bold mb-2">Which country are you checking?</h2>
              <p className="text-neutral-500 mb-8">Choose the destination country so the visa checklist is anchored to one system.</p>

              <label className="block text-sm font-semibold mb-2 uppercase tracking-wider text-neutral-400">Target country</label>
              <select
                value={formData.visaCountry}
                onChange={(event) => updateFormData('visaCountry', event.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all bg-white"
              >
                {visaCountryOptions.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );

      case 'path':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-[28px] font-bold mb-2">Which visa path fits your case?</h2>
              <p className="text-neutral-500 mb-8">Pick the closest visa category so the checklist can focus on the right requirements.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(['Work visa', 'Student visa', 'Skilled migration', 'Digital nomad visa', 'Tourist visa'] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => updateFormData('visaCategory', item)}
                    className={`p-5 rounded-xl border-2 text-left transition-all ${
                      formData.visaCategory === item
                        ? 'border-neutral-900 bg-neutral-100 text-neutral-900'
                        : 'border-neutral-100 bg-white text-neutral-500 hover:border-neutral-200'
                    }`}
                  >
                    <p className="font-bold text-base">{item}</p>
                    <p className="mt-2 text-sm leading-6">Use the closest category. You can refine requirements later.</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 'profile':
        if (formData.searchType === SearchType.SCHOLARSHIP) {
          return (
            <div className="space-y-6">
              <div>
                <h2 className="text-[28px] font-bold mb-2">Tell us about your academic profile</h2>
                <p className="text-neutral-500 mb-8">These details shape scholarship fit and application readiness.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold mb-2 uppercase tracking-wider text-neutral-400">Study level</label>
                    <select
                      value={formData.studyLevel}
                      onChange={(event) => updateFormData('studyLevel', event.target.value as IntakeFormData['studyLevel'])}
                      className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all bg-white"
                    >
                      <option value="">Select a study level</option>
                      <option value="Undergraduate">Undergraduate</option>
                      <option value="Masters">Masters</option>
                      <option value="PhD">PhD</option>
                      <option value="Professional">Professional</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2 uppercase tracking-wider text-neutral-400">Academic background</label>
                    <input
                      type="text"
                      value={formData.academicBackground}
                      onChange={(event) => updateFormData('academicBackground', event.target.value)}
                      placeholder="e.g. BSc Computer Science, final-year economics student"
                      className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-[28px] font-bold mb-2">Add your visa profile context</h2>
              <p className="text-neutral-500 mb-8">This helps keep the visa requirement checklist grounded in your case.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold mb-2 uppercase tracking-wider text-neutral-400">Nationality</label>
                  <input
                    type="text"
                    value={formData.nationality}
                    onChange={(event) => updateFormData('nationality', event.target.value)}
                    placeholder="e.g. Nigerian"
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2 uppercase tracking-wider text-neutral-400">Current residence</label>
                  <input
                    type="text"
                    value={formData.currentResidence}
                    onChange={(event) => updateFormData('currentResidence', event.target.value)}
                    placeholder="e.g. Lagos, Nigeria"
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all"
                  />
                </div>
              </div>

              <div className="mt-6">
                <label className="block text-sm font-semibold mb-2 uppercase tracking-wider text-neutral-400">Travel reason</label>
                <input
                  type="text"
                  value={formData.travelReason}
                  onChange={(event) => updateFormData('travelReason', event.target.value)}
                  placeholder="e.g. Skilled work, relocation, university admission"
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all"
                />
              </div>
            </div>
          </div>
        );

      case 'documents':
        if (formData.searchType === SearchType.SCHOLARSHIP) {
          return (
            <div className="space-y-6">
              <div>
                <h2 className="text-[28px] font-bold mb-2">Upload a supporting document (optional)</h2>
                <p className="text-neutral-500 mb-3">You can attach a transcript, SOP, or brief note for this scholarship criteria set.</p>
                <p className="text-xs text-neutral-500 mb-8">Accepted formats: PDF or DOCX, up to 5MB.</p>

                <input
                  ref={scholarshipFileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={(event) => updateFormData('scholarshipDocument', event.target.files?.[0] || null)}
                />

                <button
                  type="button"
                  onClick={() => scholarshipFileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-neutral-200 rounded-2xl p-12 text-center bg-white hover:border-neutral-400 transition-all cursor-pointer group"
                >
                  <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-neutral-100 group-hover:text-neutral-900 transition-all">
                    <Upload size={32} />
                  </div>
                  <h4 className="text-lg font-bold mb-1">Select a supporting file</h4>
                  <p className="text-sm text-neutral-400 mb-6">Click to browse files from your device</p>
                  <span className="px-6 py-2 bg-neutral-900 text-white rounded-lg font-medium">Browse Files</span>
                </button>

                {renderDocumentNotice(formData.scholarshipDocument, () => updateFormData('scholarshipDocument', null), 'sky')}
              </div>
            </div>
          );
        }

        if (formData.searchType === SearchType.VISA) {
          return (
            <div className="space-y-6">
              <div>
                <h2 className="text-[28px] font-bold mb-2">Upload a reference document (optional)</h2>
                <p className="text-neutral-500 mb-3">You can attach an admission letter, job offer, or checklist note for this visa flow.</p>
                <p className="text-xs text-neutral-500 mb-8">Accepted formats: PDF or DOCX, up to 5MB.</p>

                <input
                  ref={visaFileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={(event) => updateFormData('visaDocument', event.target.files?.[0] || null)}
                />

                <button
                  type="button"
                  onClick={() => visaFileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-neutral-200 rounded-2xl p-12 text-center bg-white hover:border-neutral-400 transition-all cursor-pointer group"
                >
                  <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-neutral-100 group-hover:text-neutral-900 transition-all">
                    <Upload size={32} />
                  </div>
                  <h4 className="text-lg font-bold mb-1">Select a reference file</h4>
                  <p className="text-sm text-neutral-400 mb-6">Click to browse files from your device</p>
                  <span className="px-6 py-2 bg-neutral-900 text-white rounded-lg font-medium">Browse Files</span>
                </button>

                {renderDocumentNotice(formData.visaDocument, () => updateFormData('visaDocument', null), 'sky')}
              </div>
            </div>
          );
        }

        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-[28px] font-bold mb-2">Upload your CV (optional)</h2>
              <p className="text-neutral-500 mb-3">You can upload now for better keyword extraction, or skip and continue.</p>
              <p className="text-xs text-neutral-500 mb-8">Accepted formats: PDF or DOCX, up to 5MB.</p>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={(event) => updateFormData('cv', event.target.files?.[0] || null)}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-neutral-200 rounded-2xl p-12 text-center bg-white hover:border-neutral-400 transition-all cursor-pointer group"
              >
                <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-neutral-100 group-hover:text-neutral-900 transition-all">
                  <Upload size={32} />
                </div>
                <h4 className="text-lg font-bold mb-1">Select a CV file</h4>
                <p className="text-sm text-neutral-400 mb-6">Click to browse files from your device</p>
                <span className="px-6 py-2 bg-neutral-900 text-white rounded-lg font-medium">Browse Files</span>
              </button>

              {renderDocumentNotice(formData.cv, () => updateFormData('cv', null), 'emerald')}
            </div>
          </div>
        );

      case 'preferences':
        if (formData.searchType === SearchType.SCHOLARSHIP) {
          return (
            <div className="space-y-6">
              <div>
                <h2 className="text-[28px] font-bold mb-2">Fine-tune scholarship preferences</h2>
                <p className="text-neutral-500 mb-3">These fields are optional, but they help narrow matching criteria.</p>
                <p className="text-xs text-neutral-500 mb-8">Leave empty if you want a broader opportunity list.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold mb-2 uppercase tracking-wider text-neutral-400">Funding preference</label>
                    <select
                      value={formData.fundingType}
                      onChange={(event) => updateFormData('fundingType', event.target.value as IntakeFormData['fundingType'])}
                      className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all bg-white"
                    >
                      <option value="">Select funding type</option>
                      <option value="Full funding">Full funding</option>
                      <option value="Partial funding">Partial funding</option>
                      <option value="Tuition only">Tuition only</option>
                      <option value="Any funding">Any funding</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2 uppercase tracking-wider text-neutral-400">Target intake</label>
                    <input
                      type="text"
                      value={formData.intakeTerm}
                      onChange={(event) => updateFormData('intakeTerm', event.target.value)}
                      placeholder="e.g. Fall 2026"
                      className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        }

        if (formData.searchType === SearchType.VISA) {
          return (
            <div className="space-y-6">
              <div>
                <h2 className="text-[28px] font-bold mb-2">Fine-tune visa preferences</h2>
                <p className="text-neutral-500 mb-3">Optional context makes the checklist more useful without changing your core path.</p>
                <p className="text-xs text-neutral-500 mb-8">Leave these flexible if you only need a broad preparation list.</p>

                <div>
                  <label className="block text-sm font-semibold mb-2 uppercase tracking-wider text-neutral-400">Travel timeline</label>
                  <input
                    type="text"
                    value={formData.visaTimeline}
                    onChange={(event) => updateFormData('visaTimeline', event.target.value)}
                    placeholder="e.g. Within 3 months"
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {visaTimelineSuggestions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => updateFormData('visaTimeline', option)}
                        className="px-2.5 py-1 rounded-md text-xs border border-neutral-200 text-neutral-600 hover:border-neutral-400"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-[28px] font-bold mb-2">Fine-tune your search</h2>
              <p className="text-neutral-500 mb-3">These fields are optional but help improve ranking quality.</p>
              <p className="text-xs text-neutral-500 mb-8">If unsure, leave empty and continue. You can adjust later.</p>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold mb-2 uppercase tracking-wider text-neutral-400">Target industry</label>
                    <input
                      type="text"
                      value={formData.industry}
                      onChange={(event) => updateFormData('industry', event.target.value)}
                      placeholder="e.g. FinTech, HealthTech"
                      className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all"
                    />
                    <p className="mt-2 text-xs text-neutral-500">Use one industry keyword. Leave blank for broader matching.</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {industrySuggestions.map((industry) => (
                        <button
                          key={industry}
                          type="button"
                          onClick={() => updateFormData('industry', industry)}
                          className="px-2.5 py-1 rounded-md text-xs border border-neutral-200 text-neutral-600 hover:border-neutral-400"
                        >
                          {industry}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2 uppercase tracking-wider text-neutral-400">Minimum salary (annual)</label>
                    <input
                      type="text"
                      value={formData.salary}
                      onChange={(event) => updateFormData('salary', event.target.value)}
                      placeholder="e.g. $80,000"
                      className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all"
                    />
                    <p className="mt-2 text-xs text-neutral-500">Use your preferred minimum, or leave empty if salary is flexible.</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {salarySuggestions.map((salary) => (
                        <button
                          key={salary}
                          type="button"
                          onClick={() => updateFormData('salary', salary)}
                          className="px-2.5 py-1 rounded-md text-xs border border-neutral-200 text-neutral-600 hover:border-neutral-400"
                        >
                          {salary}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl border border-neutral-200 bg-white">
                  <div>
                    <h4 className="font-bold">Visa sponsorship required</h4>
                    <p className="text-sm text-neutral-500">Only show roles that explicitly mention sponsorship support.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateFormData('visaSponsorship', !formData.visaSponsorship)}
                    className={`w-12 h-6 rounded-full transition-all relative ${formData.visaSponsorship ? 'bg-neutral-900' : 'bg-neutral-200'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${formData.visaSponsorship ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'review':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-[28px] font-bold mb-2">Review your criteria</h2>
              <p className="text-neutral-500 mb-8">
                {formData.searchType === SearchType.JOB
                  ? 'Check your required settings before starting the live search.'
                  : 'Check your settings before saving this search flow to your recent searches.'}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderReviewCards().map((item) => (
                  <div key={item.label} className="p-4 rounded-xl bg-white border border-neutral-100 flex justify-between items-start gap-3">
                    <div>
                      <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">{item.label}</p>
                      <p className="font-medium">{item.value}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(item.step)}
                      className="text-xs font-bold text-neutral-900 hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (submittedSession) {
    return (
      <div className="space-y-8 py-4 md:py-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm md:p-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <Check size={28} />
          </div>
          <h1 className="mt-6 text-[30px] font-bold tracking-tight text-neutral-950">Criteria saved to Recent Searches.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-neutral-500 md:text-base">
            {formData.searchType === SearchType.SCHOLARSHIP
              ? 'This scholarship flow is now saved as a structured search profile. Live scholarship runs are not wired yet, so this was stored for reuse and future execution.'
              : 'This visa requirement flow is now saved as a structured checklist search. Live visa runs are not wired yet, so this was stored for reuse and future execution.'}
          </p>

          <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-neutral-400">Saved flow</p>
            <p className="mt-2 text-lg font-bold text-neutral-950">{getSearchTypeLabel(submittedSession.type)}</p>
            <p className="mt-1 text-sm text-neutral-500">Session ID: {submittedSession.sessionId}</p>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate('/new-search')}
              className="min-h-[48px] rounded-xl bg-neutral-900 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-black"
            >
              Back to search hub
            </button>
            <button
              type="button"
              onClick={() => {
                setSubmittedSession(null);
                setCurrentStep(steps.length - 1);
              }}
              className="min-h-[48px] rounded-xl border border-neutral-200 bg-white px-5 py-3 text-sm font-bold text-neutral-700 transition-all hover:text-neutral-950"
            >
              Review saved criteria
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 py-4 md:py-8">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 md:gap-12">
        <div className="lg:col-span-1">
          <div className="sticky top-24 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-4 lg:pb-0 no-scrollbar">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              const active = currentStep === index;
              const completed = index < currentStep && isStepValid(index);
              const accessible = isStepAccessible(index);

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => {
                    if (accessible) setCurrentStep(index);
                  }}
                  disabled={!accessible}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all whitespace-nowrap lg:whitespace-normal flex-shrink-0 lg:flex-shrink text-left ${
                    active ? 'bg-white shadow-sm border border-neutral-100' : 'opacity-70'
                  } ${accessible ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all flex-shrink-0 ${
                      active || completed ? 'bg-neutral-900 text-white' : 'bg-neutral-200 text-neutral-500'
                    }`}
                  >
                    {completed ? <Check size={16} /> : <StepIcon size={16} />}
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-sm font-bold ${active ? 'text-neutral-900' : 'text-neutral-500'}`}>{step.title}</span>
                    {active && <span className="text-[10px] uppercase tracking-widest text-neutral-900 font-bold hidden lg:block">Active</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6 md:p-12 min-h-[420px] md:min-h-[520px] flex flex-col">
            <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <span className="inline-flex rounded-full bg-neutral-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-500">
                  {getSearchTypeLabel(formData.searchType)}
                </span>
                <h1 className="mt-3 text-[28px] font-bold tracking-tight text-neutral-950">
                  {formData.searchType === SearchType.JOB && 'Job search intake'}
                  {formData.searchType === SearchType.SCHOLARSHIP && 'Scholarship search intake'}
                  {formData.searchType === SearchType.VISA && 'Visa requirement intake'}
                </h1>
                <p className="mt-2 text-sm leading-7 text-neutral-500">
                  {formData.searchType === SearchType.JOB && 'Set the criteria for a live job run, then hand off to the search session.'}
                  {formData.searchType === SearchType.SCHOLARSHIP && 'Capture structured scholarship criteria now. This flow saves your search setup for reuse while scholarship runs are still offline.'}
                  {formData.searchType === SearchType.VISA && 'Capture structured visa criteria now. This flow saves your search setup for reuse while visa runs are still offline.'}
                </p>
              </div>
            </div>

            {reusedFromSessionId && (
              <div className="mb-6 p-4 rounded-xl border border-sky-200 bg-sky-50 text-sky-900 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest">Based on previous search</p>
                  <p className="text-sm mt-1">You are editing criteria copied from session {reusedFromSessionId}.</p>
                </div>
                <button
                  type="button"
                  onClick={handleResetPrefill}
                  className="px-3 py-2 rounded-lg text-xs font-bold bg-white text-sky-900 border border-sky-200 hover:border-sky-300 transition-all"
                >
                  Use blank form
                </button>
              </div>
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={`${formData.searchType}-${steps[currentStep]?.id}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
                className="flex-1"
              >
                {renderStepContent()}
              </motion.div>
            </AnimatePresence>

            {currentStepError && (
              <div className="mt-6 p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5" />
                <p className="text-sm">{currentStepError}</p>
              </div>
            )}

            {steps[currentStep]?.id === 'review' && formData.searchType !== SearchType.JOB && (
              <div className="mt-6 p-3 rounded-xl border border-sky-200 bg-sky-50 text-sky-900 flex items-start gap-2">
                <Sparkles size={16} className="mt-0.5" />
                <p className="text-sm">This flow saves structured criteria now. Live {formData.searchType === SearchType.SCHOLARSHIP ? 'scholarship' : 'visa'} execution will plug in later.</p>
              </div>
            )}

            <div className="mt-8 md:mt-12 flex items-center justify-between pt-6 md:pt-8 border-t border-neutral-100">
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-2 px-4 md:px-6 py-3 text-neutral-500 font-bold hover:text-neutral-900 transition-all min-h-[44px]"
              >
                <ArrowLeft size={20} />
                <span className="hidden sm:inline">Back</span>
              </button>

              <button
                type="button"
                onClick={handleNext}
                disabled={!isCurrentStepValid}
                className="flex items-center gap-2 px-8 md:px-10 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-black shadow-xl shadow-neutral-200 active:scale-95 transition-all min-h-[48px] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-neutral-900"
              >
                {currentStep === steps.length - 1
                  ? formData.searchType === SearchType.JOB
                    ? 'Run Search'
                    : 'Save Search'
                  : 'Next Step'}
                <ArrowRight size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
