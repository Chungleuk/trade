import React, { useMemo, useState } from 'react';
import { Search, Filter, TrendingUp, AlertTriangle, RefreshCw, Loader2, Check, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Trash2, ArrowUpDown } from 'lucide-react';
import { TradingAlert } from '../types/alert';
import { AlertCard } from './AlertCard';

interface AlertsListProps {
  alerts: TradingAlert[];
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onUpdateStatus?: (alertId: string, status: 'active' | 'completed' | 'stopped') => void;
  onMarkOutcome?: (alertId: string, outcome: 'win' | 'loss') => void;
  onDelete?: (alertId: string) => void;
  onDeleteByGroup?: (symbol: string) => Promise<void>;
  onSaveManualMessage?: (alertId: string, message: string) => Promise<boolean>;
}

export const AlertsList: React.FC<AlertsListProps> = ({ 
  alerts, 
  loading = false, 
  error, 
  onRefresh, 
  onUpdateStatus, 
  onMarkOutcome,
  onDelete,
  onDeleteByGroup,
  onSaveManualMessage
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'active' | 'completed' | 'stopped'>('ALL');
  /** win | loss | none | ALL — filter by marked outcome */
  const [filterOutcome, setFilterOutcome] = useState<'ALL' | 'win' | 'loss' | 'none'>('ALL');
  type SortOption = 'newest' | 'oldest' | 'symbol_asc' | 'symbol_desc';
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  /** Comma-separated symbols (manual quick filter), e.g. XAUUSD, EURUSD */
  const [manualSymbolsInput, setManualSymbolsInput] = useState('');
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [deleteGroupDropdownOpen, setDeleteGroupDropdownOpen] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState<string | null>(null);

  const allGroups = useMemo(() => {
    const set = new Set<string>();
    alerts.forEach(a => set.add(a.symbol.toUpperCase()));
    return Array.from(set).sort();
  }, [alerts]);

  const manualSymbolTokens = useMemo(() => {
    return manualSymbolsInput
      .split(/[\s,;]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
  }, [manualSymbolsInput]);

  const filteredAlerts = useMemo(() => {
    const list = alerts.filter((alert) => {
      const sym = alert.symbol.toLowerCase();
      const id = alert.id.toLowerCase();
      const msg = (alert.message || alert.rawMessage || '').toLowerCase();
      const matchesSearch =
        searchTerm === '' ||
        sym.includes(searchTerm.toLowerCase()) ||
        id.includes(searchTerm.toLowerCase()) ||
        msg.includes(searchTerm.toLowerCase());
      const matchesFilter = filterAction === 'ALL' || alert.action === filterAction;
      const matchesStatus = filterStatus === 'ALL' || alert.status === filterStatus;
      const matchesGroup =
        selectedGroups.length === 0 || selectedGroups.includes(alert.symbol.toUpperCase());
      const matchesManualSymbols =
        manualSymbolTokens.length === 0 ||
        manualSymbolTokens.includes(alert.symbol.toUpperCase());
      let matchesOutcome = true;
      if (filterOutcome === 'win') matchesOutcome = alert.outcome === 'win';
      else if (filterOutcome === 'loss') matchesOutcome = alert.outcome === 'loss';
      else if (filterOutcome === 'none') matchesOutcome = !alert.outcome;

      return (
        matchesSearch &&
        matchesFilter &&
        matchesStatus &&
        matchesGroup &&
        matchesManualSymbols &&
        matchesOutcome
      );
    });

    const parseTime = (a: TradingAlert) => new Date(a.timestamp).getTime();

    return [...list].sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return parseTime(a) - parseTime(b);
        case 'symbol_asc': {
          const c = a.symbol.localeCompare(b.symbol);
          return c !== 0 ? c : parseTime(b) - parseTime(a);
        }
        case 'symbol_desc': {
          const c = b.symbol.localeCompare(a.symbol);
          return c !== 0 ? c : parseTime(b) - parseTime(a);
        }
        case 'newest':
        default:
          return parseTime(b) - parseTime(a);
      }
    });
  }, [
    alerts,
    searchTerm,
    filterAction,
    filterStatus,
    filterOutcome,
    selectedGroups,
    manualSymbolTokens,
    sortBy,
  ]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredAlerts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentAlerts = filteredAlerts.slice(startIndex, endIndex);

  // Reset to first page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterAction, filterStatus, filterOutcome, selectedGroups, itemsPerPage, manualSymbolTokens, sortBy]);

  // Close dropdowns when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.delete-group-dropdown') && !target.closest('[data-delete-group-button]')) {
        setDeleteGroupDropdownOpen(false);
      }
      if (!target.closest('.group-filter-dropdown') && !target.closest('[data-group-filter-button]')) {
        setGroupDropdownOpen(false);
      }
    };

    if (deleteGroupDropdownOpen || groupDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [deleteGroupDropdownOpen, groupDropdownOpen]);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const goToFirstPage = () => goToPage(1);
  const goToLastPage = () => goToPage(totalPages);
  const goToPreviousPage = () => goToPage(currentPage - 1);
  const goToNextPage = () => goToPage(currentPage + 1);

  const LoadingState = () => (
    <div className="text-center py-12">
      <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">Loading alerts...</h3>
      <p className="text-gray-600">Please wait while we fetch your trading alerts.</p>
    </div>
  );

  const ErrorState = () => (
    <div className="text-center py-12">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <AlertTriangle className="w-8 h-8 text-red-600" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">Error loading alerts</h3>
      <p className="text-gray-600 mb-4">{error}</p>
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
      )}
    </div>
  );

  const EmptyState = () => (
    <div className="text-center py-12">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <TrendingUp className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">No alerts yet</h3>
      <p className="text-gray-600 max-w-sm mx-auto">
        Configure your TradingView alerts to start receiving signals. Once set up, your alerts will appear here in real-time.
      </p>
    </div>
  );

  const NoResultsState = () => (
    <div className="text-center py-12">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <AlertTriangle className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">No alerts match your filters</h3>
      <p className="text-gray-600">Try adjusting your search terms or filters.</p>
    </div>
  );

  const PaginationControls = () => {
    if (totalPages <= 1) return null;

    const getPageNumbers = () => {
      const pages = [];
      const maxVisiblePages = 5;
      
      if (totalPages <= maxVisiblePages) {
        for (let i = 1; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        if (currentPage <= 3) {
          for (let i = 1; i <= 4; i++) {
            pages.push(i);
          }
          pages.push('...');
          pages.push(totalPages);
        } else if (currentPage >= totalPages - 2) {
          pages.push(1);
          pages.push('...');
          for (let i = totalPages - 3; i <= totalPages; i++) {
            pages.push(i);
          }
        } else {
          pages.push(1);
          pages.push('...');
          for (let i = currentPage - 1; i <= currentPage + 1; i++) {
            pages.push(i);
          }
          pages.push('...');
          pages.push(totalPages);
        }
      }
      
      return pages;
    };

    return (
      <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200">
        <div className="flex items-center gap-4 text-sm text-gray-700">
          <span>
            Showing {startIndex + 1} to {Math.min(endIndex, filteredAlerts.length)} of {filteredAlerts.length} alerts
          </span>
          
          <div className="flex items-center gap-2">
            <span>Show:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
            </select>
            <span>per page</span>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={goToFirstPage}
            disabled={currentPage === 1}
            className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg hover:bg-gray-100"
            title="First page"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          
          <button
            onClick={goToPreviousPage}
            disabled={currentPage === 1}
            className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg hover:bg-gray-100"
            title="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-1">
            {getPageNumbers().map((page, index) => (
              <React.Fragment key={index}>
                {page === '...' ? (
                  <span className="px-3 py-2 text-gray-500">...</span>
                ) : (
                  <button
                    onClick={() => goToPage(page as number)}
                    className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                      currentPage === page
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {page}
                  </button>
                )}
              </React.Fragment>
            ))}
          </div>
          
          <button
            onClick={goToNextPage}
            disabled={currentPage === totalPages}
            className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg hover:bg-gray-100"
            title="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          
          <button
            onClick={goToLastPage}
            disabled={currentPage === totalPages}
            className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg hover:bg-gray-100"
            title="Last page"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-900">
              Trading Alerts ({filteredAlerts.length}
              {filteredAlerts.length !== alerts.length ? ` of ${alerts.length}` : ''})
            </h2>
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={loading}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                title="Refresh alerts"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
          <p className="text-gray-600 text-sm mt-1">
            Real-time alerts from your TradingView strategies and manual signals — use filters to narrow the list.
            {totalPages > 1 && ` Page ${currentPage} of ${totalPages}.`}
          </p>
        </div>

        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search alerts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-64"
            />
          </div>

          <div className="relative">
            <button
              type="button"
              data-group-filter-button
              onClick={() => setGroupDropdownOpen(v => !v)}
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              title="Filter by symbol group"
            >
              <Filter className="w-4 h-4 text-gray-500" />
              Groups
              {selectedGroups.length > 0 && (
                <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                  {selectedGroups.length}
                </span>
              )}
            </button>

            {groupDropdownOpen && (
              <div className="group-filter-dropdown absolute z-10 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg p-2">
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="text-xs font-medium text-gray-600">Select groups</span>
                  <button
                    type="button"
                    onClick={() => setSelectedGroups([])}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Clear
                  </button>
                </div>
                <div className="max-h-56 overflow-auto">
                  {allGroups.length === 0 && (
                    <div className="px-2 py-1 text-sm text-gray-500">No symbols</div>
                  )}
                  {allGroups.map(group => {
                    const selected = selectedGroups.includes(group);
                    return (
                      <button
                        type="button"
                        key={group}
                        onClick={() => setSelectedGroups(prev => selected ? prev.filter(g => g !== group) : [...prev, group])}
                        className={`w-full flex items-center justify-between px-2 py-1 text-sm rounded hover:bg-gray-50 ${selected ? 'text-gray-900' : 'text-gray-700'}`}
                      >
                        <span>{group}</span>
                        {selected && <Check className="w-4 h-4 text-blue-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value as 'ALL' | 'BUY' | 'SELL')}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="ALL">All Actions</option>
              <option value="BUY">Buy Only</option>
              <option value="SELL">Sell Only</option>
            </select>
          </div>
          
          <div className="relative">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'ALL' | 'active' | 'completed' | 'stopped')}
              className="pl-4 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="ALL">All Status</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="stopped">Stopped</option>
            </select>
          </div>

          {onDeleteByGroup && (
            <div className="relative">
              <button
                type="button"
                data-delete-group-button
                onClick={() => setDeleteGroupDropdownOpen(v => !v)}
                className="inline-flex items-center gap-2 px-3 py-2 border border-red-300 text-red-700 bg-white rounded-lg hover:bg-red-50 text-sm font-medium transition-colors"
                title="Delete all alerts by currency pair"
              >
                <Trash2 className="w-4 h-4" />
                Delete by Group
              </button>

              {deleteGroupDropdownOpen && (
                <div className="delete-group-dropdown absolute z-10 mt-2 right-0 w-56 bg-white border border-gray-200 rounded-lg shadow-lg p-2">
                  <div className="flex items-center justify-between px-2 py-1 border-b border-gray-200 mb-2">
                    <span className="text-xs font-medium text-gray-600">Select group to delete</span>
                    <button
                      type="button"
                      onClick={() => setDeleteGroupDropdownOpen(false)}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="max-h-56 overflow-auto">
                    {allGroups.length === 0 && (
                      <div className="px-2 py-1 text-sm text-gray-500">No symbols</div>
                    )}
                    {allGroups.map(group => {
                      const groupAlertsCount = alerts.filter(a => a.symbol.toUpperCase() === group).length;
                      const isDeleting = deletingGroup === group;
                      return (
                        <button
                          type="button"
                          key={group}
                          onClick={async () => {
                            if (window.confirm(`Are you sure you want to delete all ${groupAlertsCount} alert(s) for ${group}? This action cannot be undone.`)) {
                              setDeletingGroup(group);
                              try {
                                await onDeleteByGroup(group);
                                setDeleteGroupDropdownOpen(false);
                              } catch (err) {
                                console.error('Error deleting group:', err);
                              } finally {
                                setDeletingGroup(null);
                              }
                            }
                          }}
                          disabled={isDeleting}
                          className={`w-full flex items-center justify-between px-2 py-2 text-sm rounded hover:bg-red-50 transition-colors ${
                            isDeleting ? 'opacity-50 cursor-not-allowed' : 'text-red-700 hover:text-red-900'
                          }`}
                        >
                          <div className="flex flex-col items-start">
                            <span className="font-medium">{group}</span>
                            <span className="text-xs text-gray-500">{groupAlertsCount} alert(s)</span>
                          </div>
                          {isDeleting ? (
                            <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
            <ArrowUpDown className="w-4 h-4 text-slate-500" aria-hidden />
            Filters & sort
          </div>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setFilterAction('ALL');
              setFilterStatus('ALL');
              setFilterOutcome('ALL');
              setSelectedGroups([]);
              setManualSymbolsInput('');
              setSortBy('newest');
            }}
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            Clear all filters
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Symbols (type manually, comma-separated)
            </label>
            <input
              type="text"
              placeholder="e.g. XAUUSD, EURUSD, GBPUSD — leave empty for all"
              value={manualSymbolsInput}
              onChange={(e) => setManualSymbolsInput(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            />
            <p className="text-xs text-slate-500 mt-1">
              Matches any listed symbol. Works together with the Groups picker and other filters.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Outcome</label>
            <select
              value={filterOutcome}
              onChange={(e) =>
                setFilterOutcome(e.target.value as 'ALL' | 'win' | 'loss' | 'none')
              }
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All outcomes</option>
              <option value="none">No outcome yet</option>
              <option value="win">Win</option>
              <option value="loss">Loss</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Sort</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="symbol_asc">Symbol A → Z</option>
              <option value="symbol_desc">Symbol Z → A</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="space-y-3">
          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState />
          ) : alerts.length === 0 ? (
            <EmptyState />
          ) : filteredAlerts.length === 0 ? (
            <NoResultsState />
          ) : (
            <>
              <div className="p-4">
                {currentAlerts.map((alert) => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    onUpdateStatus={onUpdateStatus}
                    onMarkOutcome={onMarkOutcome}
                    onDelete={onDelete}
                    onSaveManualMessage={onSaveManualMessage}
                  />
                ))}
              </div>
              <PaginationControls />
            </>
          )}
        </div>
      </div>
    </div>
  );
};