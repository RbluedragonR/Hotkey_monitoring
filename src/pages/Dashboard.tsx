import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Table from '../component/Table'; // Adjust path if needed
import DailyAlphaCharts from '../component/DailyAlphaCharts';

const API_BASE_URL = 'https://hotkey-monitoring-backend.onrender.com/api'; // Update if backend is hosted elsewhere
// const API_BASE_URL = 'http://localhost:3000/api'; // Local backend for development
// const ALPHA_PRICE_URL = 'https://api.tao.app/api/beta/analytics/subnets/info';
// const Price_Apikey = import.meta.env.VITE_PRICE_API_KEY;
const Dashboard: React.FC = () => {
  const [coldKey, setColdKey] = useState('');
  const [subnet, setSubnet] = useState(''); // For subnet input
  const [currentSubnet, setCurrentSubnet] = useState<string | null>(null); // Display current subnet
  const [registeredKeys, setRegisteredKeys] = useState<string[]>([]);
  const [minerData, setMinerData] = useState<any[]>([]); // For Table
  // const [alphaTokenPrice, setAlphaTokenPrice] = useState(0.03); // Editable market price for Daily Earn
  const [subnetAlphaPrice, setSubnetAlphaPrice] = useState<number>(0); // From backend settings (e.g., emission)
  const [regCost, setRegCost] = useState<number>(0);
  const [regAllowed, setRegAllowed] = useState<boolean>(true);
  const [immunePeriod, setImmunePeriod] = useState<number>(0);
  const [dailyEarn, setDailyEarn] = useState(0);
  const [totalDailyAlpha, setTotalDailyAlpha] = useState(0); // For total daily alpha calculation
  const [totalStakingAlpha, setTotalStakingAlpha] = useState(0); // Total staking alpha
  const [totalStakingPrice, setTotalStakingPrice] = useState(0); // Total staking price
  const [totalMinerNum, setTotalMinerNum] = useState(0);
  const [registeredMinerNum, setRegisteredMinerNum] = useState(0);
  const [deregisteredMinerNum, setDeregisteredMinerNum] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null); // For success messages
  const [currentTaoPrice, setCurrentTaoPrice] = useState<number>(0);
  const [historyBySymbol, setHistoryBySymbol] = useState<Record<string, { t: number; v: number }[]>>({});
  const [notesByKey, setNotesByKey] = useState<Record<string, string>>({});

  // Fetch data function (now reusable)
  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch current subnet
      console.log(currentTaoPrice);
      const subnetRes = await axios.get(`${API_BASE_URL}/subnet`);
      setCurrentSubnet(subnetRes.data.subnet?.toString() || 'Not set');

      // Fetch subnet settings (new: alphaPrice, regCost, etc.)
      const settingsRes = await axios.get(`${API_BASE_URL}/settings`);
      const settings = settingsRes.data;
      // setSubnetAlphaPrice(settings.alphaPrice || 0);
      setRegCost(settings.regCost || 0);
      setRegAllowed(settings.reg_allowed ?? true);
      setImmunePeriod(settings.immunePeriod || 0);

      // Fetch coldkeys
      const coldkeysRes = await axios.get(`${API_BASE_URL}/coldkeys`);
      setRegisteredKeys(coldkeysRes.data);

      // Fetch miner data (optionally filtered by current subnet via backend)
      const minersRes = await axios.get(`${API_BASE_URL}/miners`); // Add ?subnet=${currentSubnet} if backend supports
      const mappedData = minersRes.data.map((miner: any) => {
        const stakingAlpha = miner.staking ? Number(miner.staking) : 0;
        const dailyAlphaAlpha = miner.dailyAlpha ? Number(miner.dailyAlpha) : 0;
        const usdPerAlpha = subnetAlphaPrice * currentTaoPrice;
        const stakingUsd = Math.round(stakingAlpha * usdPerAlpha);
        const dailyAlphaUsd = Math.round(dailyAlphaAlpha * usdPerAlpha);
        const symbolKey = miner.symbol ?? miner.Symbol ?? miner.uid ?? miner.hotkey;
        // Only record history when price inputs are known and > 0 to avoid zero dips on refresh
        if (symbolKey !== undefined && Number.isFinite(usdPerAlpha) && usdPerAlpha > 0) {
          const key = String(symbolKey);
          const now = Date.now();
          const point = { t: now, v: dailyAlphaUsd };
          setHistoryBySymbol((prev) => {
            const nextSeries = [...(prev[key] || []), point].slice(-2880); // keep ~2 days if 1m polling
            const next = { ...prev, [key]: nextSeries };
            try { localStorage.setItem('dailyAlphaUsdHistory', JSON.stringify(next)); } catch {}
            return next;
          });
        }
        return {
          coldkey: miner.coldkey,
          hotkey: miner.hotkey,
          UID: miner.uid,
          Ranking: miner.ranking,
          Staking: `${stakingAlpha.toFixed(2)} ($${stakingUsd})`,
          DailyAlpha: `${dailyAlphaAlpha.toFixed(2)} ($${dailyAlphaUsd})`,
          Immune: miner.immune ? 'Yes' : 'No',
          Registered: miner.deregistered ? 'No' : 'Yes',
          'In Danger': miner.inDanger ? 'Yes' : 'No',
          Deregistered: miner.deregisteredAt ? new Date(miner.deregisteredAt).toLocaleDateString() : 'No',
        };
      });
      setMinerData(mappedData);

      // Calculate totals from mappedData
      const totalDaily = mappedData.reduce(
        (sum: number, item: { DailyAlpha: string }) => sum + parseFloat(item.DailyAlpha || '0'),
        0
      );

      const totalStaking = mappedData.reduce(
        (sum: number, item: { Staking: string }) => sum + parseFloat(item.Staking || '0'),
        0
      );

      setTotalDailyAlpha(totalDaily);
      setTotalStakingAlpha(totalStaking);
      setTotalMinerNum(mappedData.length);
      setRegisteredMinerNum(mappedData.filter((m: { Registered: string }) => m.Registered === 'Yes').length);
      setDeregisteredMinerNum(mappedData.filter((m: { Registered: string }) => m.Registered === 'No').length);

    } catch (err) {
      setError('Failed to fetch data. Please try again.');
      console.error(err);
    }
    setLoading(false);
  }, [subnetAlphaPrice, currentTaoPrice]);

  // Reactive calculations for dailyEarn and totalStakingPrice

  // Fetch on mount and periodically
  useEffect(() => {
    fetchData(); // Initial fetch
    const interval = setInterval(fetchData, 60000); // Poll every minute

    // Notification polling (unchanged)
    const checkNotifications = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/notifications`);
        res.data.messages.forEach((msg: string) => {
          if (Notification.permission === 'granted') {
            new Notification('Miner Deregistration Alert', { body: msg });
          } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
              if (permission === 'granted') new Notification('Miner Deregistration Alert', { body: msg });
            });
          }
        });

      } catch (err) {
        console.error('Notification check failed:', err);
      }
    };
    const notifInterval = setInterval(checkNotifications, 60000);

    return () => {
      clearInterval(interval);
      clearInterval(notifInterval);
    };
  }, [fetchData]); // re-establish interval if deps change

  const handleRegister = async () => {
    if (coldKey && !registeredKeys.includes(coldKey)) {
      try {
        await axios.post(`${API_BASE_URL}/coldkeys`, { coldkey: coldKey });
        setRegisteredKeys([...registeredKeys, coldKey]);
        setColdKey('');
      } catch (err) {
        setError('Failed to register coldkey.');
        console.error(err);
      }
    }
  };

  const handleDelete = async (keyToDelete: string) => {
    try {
      await axios.delete(`${API_BASE_URL}/coldkeys/${keyToDelete}`);
      setRegisteredKeys(registeredKeys.filter(key => key !== keyToDelete));
    } catch (err) {
      setError('Failed to delete coldkey.');
      console.error(err);
    }
  };

  const handleSubnetChange = async () => {
    if (!subnet.trim()) {
      setError('Please enter a valid subnet.');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await axios.post(`${API_BASE_URL}/subnet`, { subnet });
      setSuccess(`Subnet updated to "${subnet}" successfully!`);
      setSubnet(''); // Clear input
      await fetchData(); // Refetch data to reflect changes (e.g., updated miners and settings)
    } catch (err) {
      setError('Failed to update subnet. Please check the value and try again.');
      console.error(err);
    }
    setLoading(false);
  };
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        console.log('Fetching price for current subnet...');

        const response = await axios.get(`${API_BASE_URL}/price`);

        console.log('Price data received:', response.data);

        if (response.data.price !== undefined) {
          setSubnetAlphaPrice(parseFloat(response.data.price));
          // console.log(`Current subnet price: $${response.data.price}`);
        } else {
          console.warn('No price data in response:', response.data);
        }
        const taoPrice = await axios.get(`${API_BASE_URL}/taoPrice`);
        if (taoPrice.data && taoPrice.data.price !== undefined) {
          setCurrentTaoPrice(parseFloat(taoPrice.data.price));
          console.log('TAO Price set to:', taoPrice.data.price);
        } else {
          console.warn('No TAO price data in response:', taoPrice.data);
        }
      } catch (error: any) {
        console.error('Failed to fetch price data:', error);
        if (error.response) {
          console.error('Error status:', error.response.status);
          console.error('Error data:', error.response.data);
        }
      }
    };

    fetchPrice();
  }, []); // No dependencies needed since backend handles the current subnet

  // Re-fetch miners whenever price inputs change so USD values update
  useEffect(() => {
    if (subnetAlphaPrice && currentTaoPrice) {
      fetchData();
    }
  }, [subnetAlphaPrice, currentTaoPrice, fetchData]);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('dailyAlphaUsdHistory');
      if (raw) setHistoryBySymbol(JSON.parse(raw));
    } catch {}
  }, []);

  // Load symbol notes (from Table.tsx) and keep in sync
  useEffect(() => {
    const loadNotes = () => {
      try {
        const raw = localStorage.getItem('symbolNotes');
        setNotesByKey(raw ? JSON.parse(raw) : {});
      } catch {
        setNotesByKey({});
      }
    };
    loadNotes();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'symbolNotes') loadNotes();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);


  useEffect(() => {
    setDailyEarn(totalDailyAlpha * subnetAlphaPrice);
    setTotalStakingPrice(totalStakingAlpha * subnetAlphaPrice);
  }, [totalDailyAlpha, totalStakingAlpha, subnetAlphaPrice]);
  console.log(subnetAlphaPrice);
  return (
    <div className="w-full p-2 md:p-4 bg-gray-50 min-h-screen">
      {/* Status Messages - Fixed at top */}
      {loading && <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-4 py-2 rounded z-50">Loading data...</div>}
      {error && <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded z-50">{error}</div>}
      {success && <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded z-50">{success}</div>}
      
      <div className="w-full space-y-3">
        
        {/* Header - Compact Row */}
        <div className="bg-white rounded-lg shadow-sm p-3">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Current Subnet */}
            <div className="text-center md:text-left">
              <div className="text-2xl md:text-3xl font-bold text-red-500 italic">
                Current Subnet: {currentSubnet || 'Loading...'}
              </div>
              
              {/* Subnet Input - Compact */}
              <div className="flex flex-col sm:flex-row items-center gap-2 mt-2">
                <div className="text-sm md:text-base">Subnet:</div>
                <input
                  type="text"
                  value={subnet}
                  onChange={e => setSubnet(e.target.value)}
                  placeholder="Enter subnet"
                  className="border px-2 py-1 rounded text-center w-24 text-sm"
                />
                <button
                  onClick={handleSubnetChange}
                  className="bg-blue-500 text-white px-3 py-1 rounded hover:cursor-pointer hover:bg-red-400 disabled:opacity-50 text-sm"
                  disabled={loading}
                >
                  Enter
                </button>
              </div>
            </div>

            {/* TAO Price - Prominent */}
            <div className="text-center sticky top-0">
              <div className="text-xl md:text-3xl font-bold mb-2">TAO Price</div>
              <div className="text-3xl md:text-5xl font-bold text-red-500">{currentTaoPrice.toFixed(2)} $</div>
            </div>
          </div>
        </div>

        {/* Main Content - Side by Side Layout */}
        <div className="flex flex-col lg:flex-row gap-3">
          
          {/* Left Side - Coldkeys */}
          <div className="lg:w-1/3 space-y-3">
            {/* Coldkey Management */}
            <div className="bg-white rounded-lg shadow-sm p-3">
              <div className="flex flex-col sm:flex-row gap-2 mb-3">
                <input
                  type="text"
                  value={coldKey}
                  onChange={e => setColdKey(e.target.value)}
                  placeholder="Enter coldkey"
                  className="flex-1 border px-2 py-1 rounded text-sm"
                />
                <button
                  onClick={handleRegister}
                  className="bg-blue-500 text-white px-3 py-1 rounded hover:cursor-pointer hover:bg-red-400 text-sm whitespace-nowrap"
                >
                  Register
                </button>
              </div>
              
              {/* Coldkeys List */}
              {registeredKeys.length > 0 && (
                <div>
                  <h2 className="font-bold mb-2 text-sm">My Coldkeys</h2>
                  <div className="space-y-1">
                    {registeredKeys.map(key => (
                      <div key={key} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                        <span className="truncate flex-1 mr-2">{key}</span>
                        <button
                          onClick={() => handleDelete(key)}
                          className="bg-red-500 text-white px-2 py-1 rounded hover:cursor-pointer hover:bg-red-300 text-xs flex-shrink-0"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Side - Stats */}
          <div className="lg:w-2/3 space-y-3">
            
            {/* Alpha Token Price */}
            <div className="bg-white rounded-lg shadow-sm p-3 text-center">
              <h2 className="font-bold mb-2">Alpha Token Price</h2>
              <div className="text-lg">{subnetAlphaPrice.toFixed(6)} τ</div>
              <div className="text-lg">${(subnetAlphaPrice * currentTaoPrice).toFixed(2)}</div>
            </div>

            {/* Daily Stats - Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-lg shadow-sm p-3 text-center">
                <h2 className="font-bold mb-2">Daily Total Alpha</h2>
                <div className="text-lg">{totalDailyAlpha.toFixed(2)}</div>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-3 text-center">
                <h2 className="font-bold mb-2">Daily Earn</h2>
                <div className="text-lg">{dailyEarn.toFixed(2)} τ</div>
                <div className="text-lg">${(dailyEarn * currentTaoPrice).toFixed(2)}</div>
              </div>
            </div>

            {/* Staking Stats - Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-lg shadow-sm p-3 text-center">
                <h2 className="font-bold mb-2">Total Staking Alpha</h2>
                <div className="text-lg">{totalStakingAlpha.toFixed(2)}</div>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-3 text-center">
                <h2 className="font-bold mb-2">Total Staking Price</h2>
                <div className="text-lg">{totalStakingPrice.toFixed(2)} τ</div>
                <div className="text-lg">${(totalStakingPrice * currentTaoPrice).toFixed(2)}</div>
              </div>
            </div>

            {/* Miner Stats - Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-lg shadow-sm p-3 text-center">
                <h2 className="font-bold mb-2">Total Miners</h2>
                <div className="text-lg">{totalMinerNum}</div>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-3 text-center">
                <h2 className="font-bold mb-2">Registered Miner</h2>
                <div className="text-lg">{registeredMinerNum}</div>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-3 text-center">
                <h2 className="font-bold mb-2">Deregistered Miner</h2>
                <div className="text-lg">{deregisteredMinerNum}</div>
              </div>
            </div>

            {/* Network Stats - Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-lg shadow-sm p-3 text-center">
                <h2 className="font-bold mb-2">Reg Cost</h2>
                <div className="text-lg">{regCost.toFixed(2)}t</div>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-3 text-center">
                <h2 className="font-bold mb-2">Reg Allowed</h2>
                <div className="text-lg">{regAllowed ? 'Yes' : 'No'}</div>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-3 text-center">
                <h2 className="font-bold mb-2">Immune Period</h2>
                <div className="text-sm">
                  {immunePeriod} ({Math.floor(immunePeriod / 300)}h, {Math.floor((immunePeriod % 300) / 5)}m)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="p-3 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-700">Miner Data</h3>
          </div>
          <div className="overflow-x-auto">
            <Table rowData={minerData} />
          </div>
        </div>

        {/* Charts */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="p-3 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-700">Daily Alpha USD History</h3>
          </div>
          <div className="p-3">
            <DailyAlphaCharts dataByKey={historyBySymbol} notesByKey={notesByKey} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;