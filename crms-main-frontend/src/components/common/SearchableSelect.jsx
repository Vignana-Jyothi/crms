import React from 'react';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';

export default function SearchableSelect({ options, value, onChange, placeholder, disabled, className, allowCreate = false }) {
  // react-select expects options as { value, label }
  // Find the selected object based on value
  const selectedOption = options.find(opt => opt.value === value) || (allowCreate && value ? { value, label: value } : null);

  const SelectComponent = allowCreate ? CreatableSelect : Select;

  const customStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: '38px',
      backgroundColor: state.isDisabled ? '#f8fafc' : '#f8fafc',
      borderColor: state.isFocused ? '#4f46e5' : '#e2e8f0',
      borderRadius: '0.5rem',
      boxShadow: state.isFocused ? '0 0 0 1px #4f46e5' : 'none',
      '&:hover': {
        borderColor: state.isFocused ? '#4f46e5' : '#cbd5e1'
      }
    }),
    valueContainer: (base) => ({
      ...base,
      padding: '2px 8px',
    }),
    input: (base) => ({
      ...base,
      margin: '0',
      padding: '0',
    }),
    placeholder: (base) => ({
      ...base,
      color: '#64748b',
      fontSize: '0.875rem',
    }),
    singleValue: (base) => ({
      ...base,
      color: '#1e293b',
      fontSize: '0.875rem',
    }),
    menu: (base) => ({
      ...base,
      borderRadius: '0.5rem',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      zIndex: 9999,
      fontSize: '0.875rem',
    }),
    menuPortal: (base) => ({
      ...base,
      zIndex: 9999,
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected 
        ? '#4f46e5' 
        : state.isFocused 
          ? '#e0e7ff' 
          : 'white',
      color: state.isSelected ? 'white' : '#1e293b',
      '&:active': {
        backgroundColor: '#c7d2fe'
      }
    }),
  };

  return (
    <div className={`flex-1 ${className || ''}`}>
      <SelectComponent
        value={selectedOption}
        onChange={(option) => onChange(option ? option.value : '')}
        options={options}
        placeholder={placeholder}
        isDisabled={disabled}
        isClearable={false}
        isSearchable={true}
        styles={customStyles}
        menuPortalTarget={document.body}
        menuPosition="fixed"
        formatCreateLabel={(inputValue) => `Use custom "${inputValue}"`}
      />
    </div>
  );
}
