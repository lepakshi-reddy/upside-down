
import React from 'react';

const stages = [
  {
    title: 'Sowing',
    icon: '🌱',
    color: 'bg-green-100 text-green-700',
    description: 'The process of planting seeds in the soil. Key factors include depth, spacing, and timing based on climate.'
  },
  {
    title: 'Irrigation',
    icon: '💧',
    color: 'bg-blue-100 text-blue-700',
    description: 'Supplying water to crops at regular intervals. Essential for nutrient absorption and growth stability.'
  },
  {
    title: 'Harvesting',
    icon: '🌾',
    color: 'bg-amber-100 text-amber-700',
    description: 'Gathering mature crops from the fields. Requires precise timing to ensure maximum nutritional value.'
  },
  {
    title: 'Storage',
    icon: '🏠',
    color: 'bg-stone-100 text-stone-700',
    description: 'Protecting harvested crops from pests and moisture. Proper ventilation and temperature control are vital.'
  }
];

const LifecycleVisualizer: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 py-12" id="lifecycle">
      {stages.map((stage, idx) => (
        <div key={idx} className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200 hover:shadow-md transition-shadow relative group">
          <div className={`w-12 h-12 ${stage.color} rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform`}>
            {stage.icon}
          </div>
          <h4 className="text-xl font-bold text-stone-800 mb-2">{stage.title}</h4>
          <p className="text-sm text-stone-600 leading-relaxed">
            {stage.description}
          </p>
          <div className="absolute top-6 right-6 text-stone-200 font-bold text-4xl select-none">
            0{idx + 1}
          </div>
        </div>
      ))}
    </div>
  );
};

export default LifecycleVisualizer;
