import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Check,
  ArrowLeft,
  ArrowRight,
  Upload,
  X,
  Globe,
  Briefcase,
  User,
  FileText,
  Settings,
  GraduationCap,
  Compass,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SearchType } from '../types';

type SearchOptionId = SearchType.JOB | SearchType.SCHOLARSHIP | SearchType.VISA;
type StepId = 'searchType' | 'roles' | 'location' | 'experience' | 'documents' | 'preferences' | 'review';

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
};

const steps: Array<{ id: StepId; title: string; icon: React.ComponentType<{ size?: number }> }> = [
  { id: 'searchType', title: 'Search Type', icon: Compass },
  { id: 'roles', title: 'Roles', icon: User },
  { id: 'location', title: 'Location', icon: Globe },
  { id: 'experience', title: 'Experience', icon: Briefcase },
  { id: 'documents', title: 'Documents', icon: FileText },
  { id: 'preferences', title: 'Preferences', icon: Settings },
  { id: 'review', title: 'Review', icon: Check },
];

const searchTypeOptions: Array<{
  id: SearchOptionId;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number }>;
  enabled: boolean;
  artifactNote?: string;
}> = [
  {
    id: SearchType.JOB,
    title: 'Jobs',
    description: 'Find verified roles that match your skills and preferences.',
    icon: Briefcase,
    enabled: true,
  },
  {
    id: SearchType.SCHOLARSHIP,
    title: 'Scholarships',
    description: 'Explore funding opportunities for your next study program.',
    icon: GraduationCap,
    enabled: false,
    artifactNote: 'Artifact preview only. Scholarship run flow is not available yet.',
  },
  {
    id: SearchType.VISA,
    title: 'Visa Requirements',
    description: 'Get country-specific visa guidance and document checklists.',
    icon: FileText,
    enabled: false,
    artifactNote: 'Artifact preview only. Visa run flow is not available yet.',
  },
];

const roleSuggestions = [
  'Backend Engineer',
  'Full Stack Developer',
  'DevOps Engineer',
  'Cloud Architect',
  'Data Engineer',
  'Platform Engineer',
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

const industrySuggestions = ['FinTech', 'HealthTech', 'EdTech', 'AI/ML', 'SaaS', 'E-commerce'];
const salarySuggestions = ['$60,000', '$80,000', '$100,000', '$120,000+'];

function normalizeType(input?: string): SearchOptionId | undefined {
  if (!input) return undefined;
  if (input === SearchType.JOB || input === SearchType.SCHOLARSHIP || input === SearchType.VISA) {
    return input;
  }
  return undefined;
}

function getSearchTypeLabel(type: SearchOptionId): string {
  if (type === SearchType.JOB) return 'Jobs';
  if (type === SearchType.SCHOLARSHIP) return 'Scholarships';
  return 'Visa Requirements';
}

export function IntakePage() {
  const { type } = useParams<{ type?: string }>();
  const navigate = useNavigate();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const initialType = normalizeType(type) || SearchType.JOB;

  const [currentStep, setCurrentStep] = React.useState(0);
  const [tagInput, setTagInput] = React.useState('');
  const [formData, setFormData] = React.useState<IntakeFormData>({
    searchType: initialType,
    roles: [],
    location: '',
    remote: false,
    experience: 'Entry',
    years: '',
    industry: '',
    salary: '',
    visaSponsorship: false,
    cv: null,
  });

  const yearsNumber = Number(formData.years);
  const isYearsValid = formData.years.trim() !== '' && Number.isFinite(yearsNumber) && yearsNumber >= 1;

  const getStepError = React.useCallback(
    (stepIndex: number) => {
      const step = steps[stepIndex];
      if (!step) return '';

      switch (step.id) {
        case 'searchType':
          if (formData.searchType !== SearchType.JOB) {
            return 'Scholarship and Visa are artifact previews for now. Select Jobs to continue.';
          }
          return '';
        case 'roles':
          return formData.roles.length > 0 ? '' : 'Add at least one target role to continue.';
        case 'location':
          return formData.location ? '' : 'Select a location option to continue.';
        case 'experience':
          return isYearsValid ? '' : 'Enter your years of experience (minimum 1) to continue.';
        case 'documents':
          return '';
        case 'preferences':
          return '';
        case 'review':
          return formData.searchType === SearchType.JOB && formData.roles.length > 0 && formData.location && isYearsValid
            ? ''
            : 'Required search criteria is incomplete. Go back and complete missing steps.';
        default:
          return '';
      }
    },
    [formData, isYearsValid],
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

    const roleExists = formData.roles.some((item) => item.toLowerCase() === role.toLowerCase());
    if (roleExists) {
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

  const handleNext = () => {
    if (!isCurrentStepValid) return;

    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
      return;
    }

    const sessionId = Math.random().toString(36).substring(7);
    navigate(`/session/${sessionId}`, { state: { type: formData.searchType, formData } });
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
      return;
    }

    navigate('/');
  };

  const renderStepContent = () => {
    switch (steps[currentStep]?.id) {
      case 'searchType':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-[28px] font-bold mb-2">What are you searching for?</h2>
              <p className="text-neutral-500 mb-8">Choose a search type to begin the guided workflow.</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {searchTypeOptions.map((option) => {
                  const selected = formData.searchType === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => updateFormData('searchType', option.id)}
                      className={`text-left p-5 rounded-2xl border-2 transition-all bg-white ${
                        selected ? 'border-neutral-900 shadow-lg shadow-neutral-100' : 'border-neutral-200 hover:border-neutral-400'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-900 flex items-center justify-center">
                          <option.icon size={20} />
                        </div>
                        {!option.enabled && (
                          <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded bg-amber-50 text-amber-700 border border-amber-100">
                            Coming soon
                          </span>
                        )}
                      </div>
                      <h3 className="mt-4 text-lg font-bold text-neutral-900">{option.title}</h3>
                      <p className="mt-1 text-sm text-neutral-500">{option.description}</p>
                      {!option.enabled && option.artifactNote && (
                        <p className="mt-3 text-xs text-amber-700">{option.artifactNote}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );

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
                    placeholder="e.g. Backend Engineer, DevOps Engineer"
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
                            selected
                              ? 'bg-neutral-900 text-white border-neutral-900'
                              : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400'
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
                    required
                  >
                    {locationOptions.map((option) => (
                      <option key={option.label} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-neutral-500">Use “Any location (all of the above)” if you do not want to limit this search by country.</p>
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
                  required
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

      case 'documents':
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
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] || null;
                  updateFormData('cv', nextFile);
                }}
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

              {formData.cv && (
                <div className="mt-6 p-4 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded flex items-center justify-center">
                      <FileText size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-emerald-900">{formData.cv.name}</p>
                      <p className="text-xs text-emerald-600">Ready for document parsing during search.</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => updateFormData('cv', null)} className="text-emerald-400 hover:text-emerald-600">
                    <X size={20} />
                  </button>
                </div>
              )}

              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1))}
                  className="text-sm font-bold text-neutral-700 hover:text-neutral-900 underline underline-offset-4"
                >
                  Skip for now
                </button>
              </div>
            </div>
          </div>
        );

      case 'preferences':
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
              <p className="text-neutral-500 mb-8">Check your required settings before starting the search.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: 'Search Type', value: getSearchTypeLabel(formData.searchType), step: 0 },
                  { label: 'Roles', value: formData.roles.join(', ') || 'None specified', step: 1 },
                  { label: 'Location', value: `${formData.location || 'Not selected'}${formData.remote ? ' (Remote included)' : ''}`, step: 2 },
                  { label: 'Experience', value: `${formData.experience}${formData.years ? ` (${formData.years} years)` : ''}`, step: 3 },
                  { label: 'CV', value: formData.cv ? formData.cv.name : 'Skipped', step: 4 },
                  { label: 'Industry', value: formData.industry || 'Any', step: 5 },
                  { label: 'Salary', value: formData.salary || 'Not specified', step: 5 },
                  { label: 'Sponsorship', value: formData.visaSponsorship ? 'Required' : 'Not required', step: 5 },
                ].map((item) => (
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 md:gap-12 py-4 md:py-8">
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
          <AnimatePresence mode="wait">
            <motion.div
              key={steps[currentStep]?.id}
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

          {steps[currentStep]?.id === 'searchType' && formData.searchType === SearchType.JOB && (
            <div className="mt-6 p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 flex items-start gap-2">
              <Sparkles size={16} className="mt-0.5" />
              <p className="text-sm">Jobs flow selected. Continue to add your search criteria.</p>
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
              {currentStep === steps.length - 1 ? 'Run Search' : 'Next Step'}
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
