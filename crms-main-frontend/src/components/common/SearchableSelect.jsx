import React from 'react';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';

export default function SearchableSelect({ options, value, onChange, placeholder, disabled, className, title, allowCreate = false }) {
  // react-select expects options as { value, label }
  // Find the selected object based on value
  const selectedOption = options.find(opt => opt.value === value) || (allowCreate && value ? { value, label: value } : null);

  const SelectComponent = allowCreate ? CreatableSelect : Select;

  const customStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: '38px',
      backgroundColor: state.isDisabled ? '#f1f5f9' : '#ffffff',
      borderColor: state.isFocused ? '#1e3a5f' : '#e3e1db',
      borderRadius: '0.5rem',
      boxShadow: state.isFocused ? '0 0 0 1px #1e3a5f' : 'none',
      '&:hover': {
        borderColor: state.isFocused ? '#1e3a5f' : '#94a3b8'
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
      color: '#1a1a1a',
      fontSize: '0.875rem',
      fontWeight: 500,
    }),
    menu: (base) => ({
      ...base,
      borderRadius: '0.5rem',
      backgroundColor: '#ffffff',
      border: '1px solid #e3e1db',
      boxShadow: '0 4px 12px rgba(30, 58, 95, 0.08), 0 2px 4px rgba(0, 0, 0, 0.05)',
      zIndex: 9999,
      fontSize: '0.875rem',
      overflow: 'hidden',
    }),
    menuPortal: (base) => ({
      ...base,
      zIndex: 9999,
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isSelected 
        ? '#1e3a5f' 
        : state.isFocused 
          ? '#e8eff7' 
          : '#ffffff',
      color: state.isSelected ? '#ffffff' : '#1a1a1a',
      cursor: 'pointer',
      '&:active': {
        backgroundColor: '#d8e5f3'
      }
    }),
  };

  return (
    <div className={`flex-1 ${className || ''}`} title={title}>
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
