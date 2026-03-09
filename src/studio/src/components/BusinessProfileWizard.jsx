import React, { useState, useEffect } from 'react';
import './BusinessProfileWizard.css';

const BusinessProfileWizard = ({ onComplete }) => {
  const [profile, setProfile] = useState({
    businessName: '',
    description: '',
    mission: '',
    vision: '',
    values: '',
    targetAudience: {
      description: '',
      painPoints: '',
      goals: ''
    },
    productsServices: [{ name: '', description: '', price: '' }],
    marketingChannels: '',
    brandVoice: '',
    goals: {
      shortTerm: '',
      longTerm: ''
    }
  });
  const [step, setStep] = useState(1);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleNestedChange = (e, section) => {
    const { name, value } = e.target;
    setProfile(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [name]: value
      }
    }));
  };

  const handleProductServiceChange = (index, e) => {
    const { name, value } = e.target;
    const newProductsServices = [...profile.productsServices];
    newProductsServices[index][name] = value;
    setProfile(prev => ({ ...prev, productsServices: newProductsServices }));
  };

  const addProductService = () => {
    setProfile(prev => ({
      ...prev,
      productsServices: [...prev.productsServices, { name: '', description: '', price: '' }]
    }));
  };

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const handleSubmit = async () => {
    // In a real app, you'd send this to the backend
    console.log('Submitting profile:', profile);
    alert('Business profile saved!');
    if (onComplete) {
      onComplete();
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div>
            <h2>Step 1: Core Identity</h2>
            <input name="businessName" value={profile.businessName} onChange={handleChange} placeholder="Business Name" />
            <textarea name="description" value={profile.description} onChange={handleChange} placeholder="Business Description"></textarea>
            <textarea name="mission" value={profile.mission} onChange={handleChange} placeholder="Mission Statement"></textarea>
            <textarea name="vision" value={profile.vision} onChange={handleChange} placeholder="Vision Statement"></textarea>
            <input name="values" value={profile.values} onChange={handleChange} placeholder="Core Values (comma-separated)" />
          </div>
        );
      case 2:
        return (
          <div>
            <h2>Step 2: Audience and Offerings</h2>
            <textarea name="description" value={profile.targetAudience.description} onChange={(e) => handleNestedChange(e, 'targetAudience')} placeholder="Target Audience Description"></textarea>
            <input name="painPoints" value={profile.targetAudience.painPoints} onChange={(e) => handleNestedChange(e, 'targetAudience')} placeholder="Pain Points (comma-separated)" />
            <input name="goals" value={profile.targetAudience.goals} onChange={(e) => handleNestedChange(e, 'targetAudience')} placeholder="Audience Goals (comma-separated)" />
            {profile.productsServices.map((ps, index) => (
              <div key={index} className="product-service">
                <input name="name" value={ps.name} onChange={(e) => handleProductServiceChange(index, e)} placeholder="Product/Service Name" />
                <input name="description" value={ps.description} onChange={(e) => handleProductServiceChange(index, e)} placeholder="Description" />
                <input name="price" value={ps.price} onChange={(e) => handleProductServiceChange(index, e)} placeholder="Price" />
              </div>
            ))}
            <button type="button" onClick={addProductService}>Add Product/Service</button>
          </div>
        );
      case 3:
        return (
          <div>
            <h2>Step 3: Marketing and Goals</h2>
            <input name="marketingChannels" value={profile.marketingChannels} onChange={handleChange} placeholder="Marketing Channels (comma-separated)" />
            <input name="brandVoice" value={profile.brandVoice} onChange={handleChange} placeholder="Brand Voice" />
            <textarea name="shortTerm" value={profile.goals.shortTerm} onChange={(e) => handleNestedChange(e, 'goals')} placeholder="Short-Term Goals (comma-separated)"></textarea>
            <textarea name="longTerm" value={profile.goals.longTerm} onChange={(e) => handleNestedChange(e, 'goals')} placeholder="Long-Term Goals (comma-separated)"></textarea>
          </div>
        );
      default:
        return <div>Review your information</div>;
    }
  };

  return (
    <div className="wizard-container">
      <div className="wizard-card">
        <h1>Business Profile Setup</h1>
        <div className="progress-bar">
          <div className="progress" style={{ width: `${(step / 3) * 100}%` }}></div>
        </div>
        <form>
          {renderStep()}
          <div className="navigation-buttons">
            {step > 1 && <button type="button" onClick={prevStep}>Back</button>}
            {step < 3 && <button type="button" onClick={nextStep}>Next</button>}
            {step === 3 && <button type="button" onClick={handleSubmit}>Finish</button>}
          </div>
        </form>
      </div>
    </div>
  );
};

export default BusinessProfileWizard;
