import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Check, ArrowLeft, ArrowRight, Upload, X, Globe, Briefcase, User, FileText, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SearchType } from '../types';

const steps = [
  { id: 'basics', title: 'Basics', icon: User },
  { id: 'location', title: 'Location', icon: Globe },
  { id: 'experience', title: 'Experience', icon: Briefcase },
  { id: 'documents', title: 'Documents', icon: FileText },
  { id: 'preferences', title: 'Preferences', icon: Settings },
  { id: 'review', title: 'Review', icon: Check },
];

export function IntakePage() {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = React.useState(0);
  const [formData, setFormData] = React.useState({
    roles: [] as string[],
    location: '',
    remote: false,
    experience: 'Entry',
    years: '',
    industry: '',
    salary: '',
    visaSponsorship: false,
    cv: null as File | null,
  });

  const [tagInput, setTagInput] = React.useState('');

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Create session and redirect
      const sessionId = Math.random().toString(36).substring(7);
      navigate(`/session/${sessionId}`, { state: { type, formData } });
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      navigate('/');
    }
  };

  const addTag = () => {
    if (tagInput && !formData.roles.includes(tagInput)) {
      setFormData({ ...formData, roles: [...formData.roles, tagInput] });
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData({ ...formData, roles: formData.roles.filter(t => t !== tag) });
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-[28px] font-bold mb-2">What roles are you targeting?</h2>
              <p className="text-neutral-500 mb-8">Enter the job titles or keywords that best describe your search.</p>
              
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addTag()}
                    placeholder="e.g. Backend Developer, DevOps Engineer..."
                    className="w-full sm:flex-1 px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all"
                  />
                  <button
                    onClick={addTag}
                    className="w-full sm:w-auto px-8 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-black transition-all active:scale-95"
                  >
                    Add
                  </button>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {formData.roles.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 px-3 py-1.5 bg-neutral-100 text-neutral-900 rounded-lg text-sm font-medium border border-neutral-200">
                      {tag}
                      <button onClick={() => removeTag(tag)} className="hover:text-black">
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-[28px] font-bold mb-2">Where would you like to work?</h2>
              <p className="text-neutral-500 mb-8">Specify your preferred countries or regions.</p>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold mb-2 uppercase tracking-wider text-neutral-400">Target Country</label>
                  <select
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all bg-white"
                  >
                    <option value="">Select a country</option>
                    <option value="Germany">Germany</option>
                    <option value="United Kingdom">United Kingdom</option>
                    <option value="Canada">Canada</option>
                    <option value="United States">United States</option>
                    <option value="Netherlands">Netherlands</option>
                  </select>
                </div>
                
                <div className="flex items-center justify-between p-4 rounded-xl border border-neutral-200 bg-white">
                  <div>
                    <h4 className="font-bold">Remote Opportunities</h4>
                    <p className="text-sm text-neutral-500">Include roles that allow working from anywhere.</p>
                  </div>
                  <button
                    onClick={() => setFormData({ ...formData, remote: !formData.remote })}
                    className={`w-12 h-6 rounded-full transition-all relative ${formData.remote ? 'bg-neutral-900' : 'bg-neutral-200'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${formData.remote ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-[28px] font-bold mb-2">What's your experience level?</h2>
              <p className="text-neutral-500 mb-8">This helps us filter for roles that match your career stage.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {['Entry', 'Mid', 'Senior'].map((level) => (
                  <button
                    key={level}
                    onClick={() => setFormData({ ...formData, experience: level })}
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
                <label className="block text-sm font-semibold mb-2 uppercase tracking-wider text-neutral-400">Years of Experience</label>
                <input
                  type="number"
                  value={formData.years}
                  onChange={(e) => setFormData({ ...formData, years: e.target.value })}
                  placeholder="e.g. 5"
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all"
                />
              </div>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-[28px] font-bold mb-2">Upload your documents</h2>
              <p className="text-neutral-500 mb-8">Uploading your CV allows us to extract keywords and match you better.</p>
              
              <div className="border-2 border-dashed border-neutral-200 rounded-2xl p-12 text-center bg-white hover:border-neutral-400 transition-all cursor-pointer group">
                <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-neutral-100 group-hover:text-neutral-900 transition-all">
                  <Upload size={32} />
                </div>
                <h4 className="text-lg font-bold mb-1">Drag & drop your CV here</h4>
                <p className="text-sm text-neutral-400 mb-6">PDF or Word documents only (max 5MB)</p>
                <button className="px-6 py-2 bg-neutral-900 text-white rounded-lg font-medium hover:bg-neutral-800 transition-all">
                  Browse Files
                </button>
              </div>
              
              {formData.cv && (
                <div className="mt-6 p-4 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded flex items-center justify-center">
                      <FileText size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-emerald-900">CV_John_Doe.pdf</p>
                      <p className="text-xs text-emerald-600">Extracted 12 key skills</p>
                    </div>
                  </div>
                  <button className="text-emerald-400 hover:text-emerald-600">
                    <X size={20} />
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-[28px] font-bold mb-2">Fine-tune your search</h2>
              <p className="text-neutral-500 mb-8">Set your preferences for industry, salary, and sponsorship.</p>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold mb-2 uppercase tracking-wider text-neutral-400">Target Industry</label>
                    <input
                      type="text"
                      value={formData.industry}
                      onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                      placeholder="e.g. FinTech, Healthcare"
                      className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2 uppercase tracking-wider text-neutral-400">Min. Salary (Annual)</label>
                    <input
                      type="text"
                      value={formData.salary}
                      onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                      placeholder="e.g. $80,000"
                      className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all"
                    />
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-4 rounded-xl border border-neutral-200 bg-white">
                  <div>
                    <h4 className="font-bold">Visa Sponsorship Required</h4>
                    <p className="text-sm text-neutral-500">Only show roles that explicitly offer sponsorship.</p>
                  </div>
                  <button
                    onClick={() => setFormData({ ...formData, visaSponsorship: !formData.visaSponsorship })}
                    className={`w-12 h-6 rounded-full transition-all relative ${formData.visaSponsorship ? 'bg-neutral-900' : 'bg-neutral-200'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${formData.visaSponsorship ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-[28px] font-bold mb-2">Review your criteria</h2>
              <p className="text-neutral-500 mb-8">Make sure everything looks correct before we start the search.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: 'Roles', value: formData.roles.join(', ') || 'None specified', step: 0 },
                  { label: 'Location', value: `${formData.location}${formData.remote ? ' (Remote)' : ''}`, step: 1 },
                  { label: 'Experience', value: `${formData.experience} (${formData.years} years)`, step: 2 },
                  { label: 'Industry', value: formData.industry || 'Any', step: 4 },
                  { label: 'Salary', value: formData.salary || 'Not specified', step: 4 },
                  { label: 'Sponsorship', value: formData.visaSponsorship ? 'Required' : 'Not required', step: 4 },
                ].map((item) => (
                  <div key={item.label} className="p-4 rounded-xl bg-white border border-neutral-100 flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">{item.label}</p>
                      <p className="font-medium">{item.value}</p>
                    </div>
                    <button 
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
      {/* Sidebar Stepper */}
      <div className="lg:col-span-1">
        <div className="sticky top-24 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-4 lg:pb-0 no-scrollbar">
          {steps.map((step, index) => (
            <div
              key={step.id}
              onClick={() => index <= currentStep && setCurrentStep(index)}
              className={`flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer whitespace-nowrap lg:whitespace-normal flex-shrink-0 lg:flex-shrink ${
                currentStep === index ? 'bg-white shadow-sm border border-neutral-100' : 'opacity-50'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all flex-shrink-0 ${
                currentStep === index 
                  ? 'bg-neutral-900 text-white' 
                  : index < currentStep 
                    ? 'bg-neutral-900 text-white' 
                    : 'bg-neutral-200 text-neutral-500'
              }`}>
                {index < currentStep ? <Check size={16} /> : index + 1}
              </div>
              <div className="flex flex-col">
                <span className={`text-sm font-bold ${currentStep === index ? 'text-neutral-900' : 'text-neutral-500'}`}>
                  {step.title}
                </span>
                {currentStep === index && (
                  <span className="text-[10px] uppercase tracking-widest text-neutral-900 font-bold hidden lg:block">Active</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:col-span-3">
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6 md:p-12 min-h-[400px] md:min-h-[500px] flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="flex-1"
            >
              {renderStepContent()}
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 md:mt-12 flex items-center justify-between pt-6 md:pt-8 border-t border-neutral-100">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-4 md:px-6 py-3 text-neutral-500 font-bold hover:text-neutral-900 transition-all min-h-[44px]"
            >
              <ArrowLeft size={20} />
              <span className="hidden sm:inline">Back</span>
            </button>
            
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-8 md:px-10 py-3 bg-neutral-900 text-white rounded-xl font-bold hover:bg-black shadow-xl shadow-neutral-200 active:scale-95 transition-all min-h-[48px]"
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
