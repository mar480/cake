
import React, { useState } from 'react';
import { Search } from 'lucide-react';

interface ToolsPanelProps {
  // Props can be added here as needed
}

const ToolsPanel: React.FC<ToolsPanelProps> = () => {
  const [activeTab, setActiveTab] = useState('Search');
  const [searchTerm, setSearchTerm] = useState('');
  
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="bg-gray-100 p-1 flex items-center justify-between border-b">
        <div className="text-sm font-semibold">Tools</div>
      </div>
      
      <div className="flex border-b">
        <button 
          className={`px-4 py-1 text-xs font-medium ${activeTab === 'Search' ? 'bg-white border-b-2 border-blue-500' : 'bg-gray-100'}`}
          onClick={() => setActiveTab('Search')}
        >
          Search
        </button>
        <button 
          className={`px-4 py-1 text-xs font-medium ${activeTab === 'Comments' ? 'bg-white border-b-2 border-blue-500' : 'bg-gray-100'}`}
          onClick={() => setActiveTab('Comments')}
        >
          Comments
        </button>
      </div>
      
      {activeTab === 'Search' && (
        <div className="p-2 space-y-2">
          <div className="flex space-x-2">
            <div className="flex-1 relative">
              <input 
                type="text" 
                className="border rounded p-1 text-sm w-full" 
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <div className="absolute right-2 top-1.5">
                <Search size={16} className="text-gray-400" />
              </div>
            </div>
            <button className="bg-gray-200 text-sm px-2 py-1 rounded">Search</button>
            <button className="bg-gray-200 text-sm px-2 py-1 rounded">References</button>
          </div>
          
          <div className="border rounded">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2 border-b">Local Name</th>
                  <th className="text-left p-2 border-b">Element Label</th>
                  <th className="text-left p-2 border-b">Matched Value</th>
                  <th className="text-left p-2 border-b">Rank</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-4 text-gray-500 text-center" colSpan={4}>
                    No search results to display
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {activeTab === 'Comments' && (
        <div className="p-4 text-center text-gray-500">
          Comments panel content will go here
        </div>
      )}
    </div>
  );
};

export default ToolsPanel;
