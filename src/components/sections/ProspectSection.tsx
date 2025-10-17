'use client';

import React, { useState } from 'react';

export default function ProspectSection() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [selectedSystemTypes, setSelectedSystemTypes] = useState<string[]>([]);
  
  const [formData, setFormData] = useState({
    // Section 1: Warm-up
    contactName: '',
    businessName: '',
    email: '',
    
    // Section 2: Problem
    problem: '',
    
    // Section 3: Desired Outcome
    dreamSystem: '',
    enablement: '',
    
    // Section 4: Context/Scope
    systemType: '',
    currentTools: '',
    hasData: '',
    
    // Section 5: Timeline & Investment
    timeline: '',
    budget: '',
    
    // Section 6: Final hook
    whyNow: '',
    additionalInfo: ''
  });

  const totalSteps = 13;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const toggleSystemType = (type: string) => {
    if (selectedSystemTypes.includes(type)) {
      setSelectedSystemTypes(selectedSystemTypes.filter(t => t !== type));
    } else {
      setSelectedSystemTypes([...selectedSystemTypes, type]);
    }
  };

  const handleNext = () => {
    // For system type step, save selected types before moving on
    if (currentStep === 7) {
      setFormData({
        ...formData,
        systemType: selectedSystemTypes.join(', ')
      });
    }
    setCurrentStep(prev => Math.min(prev + 1, totalSteps));
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitMessage('');

    try {
      const response = await fetch('/api/rfp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: formData.businessName,
          contactName: formData.contactName,
          email: formData.email,
          problem: formData.problem,
          dreamSystem: formData.dreamSystem,
          enablement: formData.enablement,
          systemType: formData.systemType,
          currentTools: formData.currentTools,
          hasData: formData.hasData,
          timeline: formData.timeline,
          whyNow: formData.whyNow,
          additionalInfo: formData.additionalInfo,
          expenseTier: formData.budget,
          selectedServices: [],
          totals: { 
            monthly: 0,
            oneTime: 0 
          }
        })
      });

      if (response.ok) {
        setSubmitMessage('Thanks! I\'ll review your project personally and reach out within 24 hours if it\'s a good fit.');
        setCurrentStep(totalSteps + 1);
      } else {
        setSubmitMessage('Something went wrong. Please try again.');
      }
    } catch (error) {
      setSubmitMessage('Error submitting request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getProgress = () => ((currentStep - 1) / totalSteps) * 100;

  return (
    <section id="pricing" className="min-h-screen py-12 sm:py-16 lg:py-24 bg-gradient-to-br from-white to-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Title Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-light text-gray-900 mb-4">Start a Project</h1>
          <p className="text-lg text-gray-600 max-w-xl mx-auto">
            Answer these questions to submit your project request. I'll review it personally and reach out within 24 hours if it's a good fit.
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
            <div 
              className="h-full bg-gradient-to-r from-[#b4b237] to-[#9a9630] transition-all duration-500 ease-out"
              style={{ width: `${getProgress()}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            {currentStep <= totalSteps ? `${currentStep} of ${totalSteps}` : 'Complete'}
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white backdrop-blur-lg rounded-3xl shadow-2xl border border-gray-100 p-6 sm:p-8 lg:p-12">
          
          {/* Success Screen */}
          {currentStep === totalSteps + 1 && (
            <div className="text-center space-y-6 py-12">
              <div className="w-20 h-20 mx-auto bg-gradient-to-r from-[#b4b237] to-[#9a9630] rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-3xl font-light text-gray-900">Application Received</h2>
              <p className="text-lg text-gray-600 max-w-md mx-auto">
                {submitMessage}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-8 py-3 bg-gradient-to-r from-[#b4b237] to-[#9a9630] text-white font-medium rounded-full hover:shadow-xl transition-all"
              >
                Submit Another
              </button>
            </div>
          )}

          {/* Step 1: Name */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-[#b4b237] uppercase tracking-wider">Section 1 of 6</p>
                <h2 className="text-3xl sm:text-4xl font-light text-gray-900">What's your name?</h2>
                <p className="text-gray-600">Let's start with the basics.</p>
              </div>
              
              <input
                type="text"
                name="contactName"
                value={formData.contactName}
                onChange={handleInputChange}
                placeholder="John Smith"
                className="w-full px-6 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-[#b4b237] transition-colors"
                autoFocus
              />

              <button
                onClick={handleNext}
                disabled={!formData.contactName}
                className="w-full py-4 bg-gradient-to-r from-[#b4b237] to-[#9a9630] text-white font-medium rounded-2xl hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </div>
          )}

          {/* Step 2: Company */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-[#b4b237] uppercase tracking-wider">Section 1 of 6</p>
                <h2 className="text-3xl sm:text-4xl font-light text-gray-900">What company or project is this for?</h2>
                <p className="text-gray-600">Leave blank if it's personal.</p>
              </div>
              
              <input
                type="text"
                name="businessName"
                value={formData.businessName}
                onChange={handleInputChange}
                placeholder="ACME Corp (optional)"
                className="w-full px-6 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-[#b4b237] transition-colors"
                autoFocus
              />

              <div className="flex gap-3">
                <button
                  onClick={handleBack}
                  className="flex-1 py-4 border-2 border-gray-300 text-gray-700 font-medium rounded-2xl hover:border-[#b4b237] transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleNext}
                  className="flex-1 py-4 bg-gradient-to-r from-[#b4b237] to-[#9a9630] text-white font-medium rounded-2xl hover:shadow-xl transition-all"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Email */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-[#b4b237] uppercase tracking-wider">Section 1 of 6</p>
                <h2 className="text-3xl sm:text-4xl font-light text-gray-900">What's the best email to reach you?</h2>
              </div>
              
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="john@example.com"
                className="w-full px-6 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-[#b4b237] transition-colors"
                autoFocus
                required
              />

              <div className="flex gap-3">
                <button
                  onClick={handleBack}
                  className="flex-1 py-4 border-2 border-gray-300 text-gray-700 font-medium rounded-2xl hover:border-[#b4b237] transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleNext}
                  disabled={!formData.email}
                  className="flex-1 py-4 bg-gradient-to-r from-[#b4b237] to-[#9a9630] text-white font-medium rounded-2xl hover:shadow-xl transition-all disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Problem */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-purple-600 uppercase tracking-wider">Section 2 of 6</p>
                <h2 className="text-3xl sm:text-4xl font-light text-gray-900">What's currently NOT working?</h2>
                <p className="text-gray-600">Be specific. What's broken, slow, or painful in your current system?</p>
              </div>
              
              <textarea
                name="problem"
                value={formData.problem}
                onChange={handleInputChange}
                placeholder="Examples: Manual spreadsheets taking 10 hours/week, messy data across 5 systems, can't scale past 100 customers..."
                rows={5}
                className="w-full px-6 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-purple-500 transition-colors resize-none"
                autoFocus
              />

              <div className="flex gap-3">
                <button
                  onClick={handleBack}
                  className="flex-1 py-4 border-2 border-gray-300 text-gray-700 font-medium rounded-2xl hover:border-[#b4b237] transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleNext}
                  disabled={!formData.problem}
                  className="flex-1 py-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-medium rounded-2xl hover:shadow-xl transition-all disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Dream System */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-[#b4b237] uppercase tracking-wider">Section 3 of 6</p>
                <h2 className="text-3xl sm:text-4xl font-light text-gray-900">If I built the perfect system for you...</h2>
                <p className="text-gray-600">What would it do? Dream big.</p>
              </div>
              
              <textarea
                name="dreamSystem"
                value={formData.dreamSystem}
                onChange={handleInputChange}
                placeholder="It would automatically sync all my bank accounts, categorize transactions, generate reports, predict cash flow..."
                rows={5}
                className="w-full px-6 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-[#b4b237] transition-colors resize-none"
                autoFocus
              />

              <div className="flex gap-3">
                <button
                  onClick={handleBack}
                  className="flex-1 py-4 border-2 border-gray-300 text-gray-700 font-medium rounded-2xl hover:border-[#b4b237] transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleNext}
                  disabled={!formData.dreamSystem}
                  className="flex-1 py-4 bg-gradient-to-r from-[#b4b237] to-[#9a9630] text-white font-medium rounded-2xl hover:shadow-xl transition-all disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 6: Enablement */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-[#b4b237] uppercase tracking-wider">Section 3 of 6</p>
                <h2 className="text-3xl sm:text-4xl font-light text-gray-900">What would that allow you to do?</h2>
                <p className="text-gray-600">That you CAN'T do right now.</p>
              </div>
              
              <textarea
                name="enablement"
                value={formData.enablement}
                onChange={handleInputChange}
                placeholder="Scale to 1000 clients, save 20 hours/week, make data-driven decisions, sleep better at night..."
                rows={5}
                className="w-full px-6 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-[#b4b237] transition-colors resize-none"
                autoFocus
              />

              <div className="flex gap-3">
                <button
                  onClick={handleBack}
                  className="flex-1 py-4 border-2 border-gray-300 text-gray-700 font-medium rounded-2xl hover:border-[#b4b237] transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleNext}
                  disabled={!formData.enablement}
                  className="flex-1 py-4 bg-gradient-to-r from-[#b4b237] to-[#9a9630] text-white font-medium rounded-2xl hover:shadow-xl transition-all disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 7: System Type - MULTI-SELECT */}
          {currentStep === 7 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-purple-600 uppercase tracking-wider">Section 4 of 6</p>
                <h2 className="text-3xl sm:text-4xl font-light text-gray-900">What type of system?</h2>
                <p className="text-gray-600">Select all that apply.</p>
              </div>
              
              <div className="space-y-3">
                {[
                  'Automated data pipeline',
                  'Dashboard / reporting',
                  'CRM or business workflow',
                  'Trading / financial system',
                  'Accounting / bookkeeping automation',
                  'Other'
                ].map(type => (
                  <button
                    key={type}
                    onClick={() => toggleSystemType(type)}
                    className={`w-full p-4 text-left border-2 rounded-2xl transition-all ${
                      selectedSystemTypes.includes(type)
                        ? 'border-purple-600 bg-purple-50'
                        : 'border-gray-200 hover:border-purple-400 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center">
                      <div className={`w-5 h-5 rounded border-2 mr-3 flex items-center justify-center ${
                        selectedSystemTypes.includes(type)
                          ? 'border-purple-600 bg-purple-600'
                          : 'border-gray-300'
                      }`}>
                        {selectedSystemTypes.includes(type) && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="font-medium text-gray-900">{type}</span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleBack}
                  className="flex-1 py-4 border-2 border-gray-300 text-gray-700 font-medium rounded-2xl hover:border-[#b4b237] transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleNext}
                  disabled={selectedSystemTypes.length === 0}
                  className="flex-1 py-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-medium rounded-2xl hover:shadow-xl transition-all disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 8: Current Tools */}
          {currentStep === 8 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-purple-600 uppercase tracking-wider">Section 4 of 6</p>
                <h2 className="text-3xl sm:text-4xl font-light text-gray-900">What tools do you currently use?</h2>
                <p className="text-gray-600">APIs, platforms, software. If any.</p>
              </div>
              
              <textarea
                name="currentTools"
                value={formData.currentTools}
                onChange={handleInputChange}
                placeholder="QuickBooks, Plaid, Excel, Airtable, Python, SQL, Zapier, Stripe..."
                rows={4}
                className="w-full px-6 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-purple-500 transition-colors resize-none"
                autoFocus
              />

              <div className="flex gap-3">
                <button
                  onClick={handleBack}
                  className="flex-1 py-4 border-2 border-gray-300 text-gray-700 font-medium rounded-2xl hover:border-[#b4b237] transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleNext}
                  className="flex-1 py-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-medium rounded-2xl hover:shadow-xl transition-all"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 9: Has Data */}
          {currentStep === 9 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-purple-600 uppercase tracking-wider">Section 4 of 6</p>
                <h2 className="text-3xl sm:text-4xl font-light text-gray-900">Do you already have data?</h2>
                <p className="text-gray-600">Or does the system need to collect it?</p>
              </div>
              
              <div className="space-y-3">
                {[
                  'I have data ready to go',
                  'System needs to collect data',
                  'Mix of both',
                  'Not sure yet'
                ].map(option => (
                  <button
                    key={option}
                    onClick={() => {
                      setFormData({...formData, hasData: option});
                      setTimeout(handleNext, 300);
                    }}
                    className={`w-full p-4 text-left border-2 rounded-2xl transition-all hover:border-purple-500 hover:bg-purple-50 ${
                      formData.hasData === option ? 'border-purple-600 bg-purple-50' : 'border-gray-200'
                    }`}
                  >
                    <span className="font-medium text-gray-900">{option}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={handleBack}
                className="w-full py-4 border-2 border-gray-300 text-gray-700 font-medium rounded-2xl hover:border-[#b4b237] transition-all"
              >
                Back
              </button>
            </div>
          )}

          {/* Step 10: Timeline */}
          {currentStep === 10 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-[#b4b237] uppercase tracking-wider">Section 5 of 6</p>
                <h2 className="text-3xl sm:text-4xl font-light text-gray-900">When do you want to get started?</h2>
              </div>
              
              <div className="space-y-3">
                {[
                  'ASAP',
                  '1–2 weeks',
                  '1–2 months',
                  'Just exploring'
                ].map(option => (
                  <button
                    key={option}
                    onClick={() => {
                      setFormData({...formData, timeline: option});
                      setTimeout(handleNext, 300);
                    }}
                    className={`w-full p-4 text-left border-2 rounded-2xl transition-all hover:border-[#b4b237] hover:bg-[#b4b237]/5 ${
                      formData.timeline === option ? 'border-[#b4b237] bg-[#b4b237]/5' : 'border-gray-200'
                    }`}
                  >
                    <span className="font-medium text-gray-900">{option}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={handleBack}
                className="w-full py-4 border-2 border-gray-300 text-gray-700 font-medium rounded-2xl hover:border-[#b4b237] transition-all"
              >
                Back
              </button>
            </div>
          )}

          {/* Step 11: Budget */}
          {currentStep === 11 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-[#b4b237] uppercase tracking-wider">Section 5 of 6</p>
                <h2 className="text-3xl sm:text-4xl font-light text-gray-900">Investment level?</h2>
                <p className="text-gray-600">What are you prepared to invest to solve this problem?</p>
              </div>
              
              <div className="space-y-3">
                {[
                  '$2k–$5k',
                  '$5k–$10k',
                  '$10k–$25k',
                  '$25k+'
                ].map(option => (
                  <button
                    key={option}
                    onClick={() => {
                      setFormData({...formData, budget: option});
                      setTimeout(handleNext, 300);
                    }}
                    className={`w-full p-4 text-left border-2 rounded-2xl transition-all hover:border-[#b4b237] hover:bg-[#b4b237]/5 ${
                      formData.budget === option ? 'border-[#b4b237] bg-[#b4b237]/5' : 'border-gray-200'
                    }`}
                  >
                    <span className="font-medium text-gray-900">{option}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={handleBack}
                className="w-full py-4 border-2 border-gray-300 text-gray-700 font-medium rounded-2xl hover:border-[#b4b237] transition-all"
              >
                Back
              </button>
            </div>
          )}

          {/* Step 12: Why Now */}
          {currentStep === 12 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-purple-600 uppercase tracking-wider">Section 6 of 6</p>
                <h2 className="text-3xl sm:text-4xl font-light text-gray-900">Why is NOW the right time?</h2>
                <p className="text-gray-600">What changed? Why can't this wait?</p>
              </div>
              
              <textarea
                name="whyNow"
                value={formData.whyNow}
                onChange={handleInputChange}
                placeholder="Business is growing fast, current system breaking, losing money, competitor pressure..."
                rows={5}
                className="w-full px-6 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-purple-500 transition-colors resize-none"
                autoFocus
              />

              <div className="flex gap-3">
                <button
                  onClick={handleBack}
                  className="flex-1 py-4 border-2 border-gray-300 text-gray-700 font-medium rounded-2xl hover:border-[#b4b237] transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleNext}
                  disabled={!formData.whyNow}
                  className="flex-1 py-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-medium rounded-2xl hover:shadow-xl transition-all disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 13: Additional Info */}
          {currentStep === 13 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-purple-600 uppercase tracking-wider">Section 6 of 6</p>
                <h2 className="text-3xl sm:text-4xl font-light text-gray-900">Anything else I should know?</h2>
                <p className="text-gray-600">Constraints, politics, hidden needs, special requirements...</p>
              </div>
              
              <textarea
                name="additionalInfo"
                value={formData.additionalInfo}
                onChange={handleInputChange}
                placeholder="Optional: Any other details that would help..."
                rows={5}
                className="w-full px-6 py-4 text-lg border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-purple-500 transition-colors resize-none"
                autoFocus
              />

              <div className="flex gap-3">
                <button
                  onClick={handleBack}
                  className="flex-1 py-4 border-2 border-gray-300 text-gray-700 font-medium rounded-2xl hover:border-[#b4b237] transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 py-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-semibold rounded-2xl hover:shadow-xl transition-all disabled:opacity-50 text-lg"
                >
                  {isSubmitting ? 'Submitting...' : "Let's Build This"}
                </button>
              </div>

              {submitMessage && !submitMessage.includes('Thanks') && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-center">
                  {submitMessage}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
