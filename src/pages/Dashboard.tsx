import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Table from '../component/Table'; // Adjust path if needed

const API_BASE_URL = 'https://hotkey-monitoring-backend.onrender.com/api'; // Update if backend is hosted elsewhere

const Dashboard: React.FC = () => {
  const [coldKey, setColdKey] = useState('');
  const [subnet, setSubnet] = useState(''); // For subnet input
  const [currentSubnet, setCurrentSubnet] = useState<string | null>(null); // Display current subnet
  const [registeredKeys, setRegisteredKeys] = useState<string[]>([]);
  const [minerData, setMinerData] = useState<any[]>([]); // For Table
  const [alphaTokenPrice, setAlphaTokenPrice] = useState(0.03); // Editable market price for Daily Earn
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

  // Fetch data function (now reusable)
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch current subnet
      const subnetRes = await axios.get(`${API_BASE_URL}/subnet`);
      setCurrentSubnet(subnetRes.data.subnet?.toString() || 'Not set');

      // Fetch subnet settings (new: alphaPrice, regCost, etc.)
      const settingsRes = await axios.get(`${API_BASE_URL}/settings`);
      const settings = settingsRes.data;
      setSubnetAlphaPrice(settings.alphaPrice || 0);
      setRegCost(settings.regCost || 0);
      setRegAllowed(settings.reg_allowed ?? true);
      setImmunePeriod(settings.immunePeriod || 0);

      // Fetch coldkeys
      const coldkeysRes = await axios.get(`${API_BASE_URL}/coldkeys`);
      setRegisteredKeys(coldkeysRes.data);

      // Fetch miner data (optionally filtered by current subnet via backend)
      const minersRes = await axios.get(`${API_BASE_URL}/miners`); // Add ?subnet=${currentSubnet} if backend supports
      const mappedData = minersRes.data.map((miner: any) => ({
        coldkey: miner.coldkey,
        hotkey: miner.hotkey,
        UID: miner.uid,
        Ranking: miner.ranking,
        Staking: (miner.staking ? Number(miner.staking).toFixed(2) : '0.00'),
        DailyAlpha: (miner.dailyAlpha ? Number(miner.dailyAlpha).toFixed(2) : '0.00'),
        Immune: miner.immune ? 'Yes' : 'No',
        Registered: miner.deregistered ? 'No' : 'Yes',
        'In Danger': miner.inDanger ? 'Yes' : 'No',
        Deregistered: miner.deregisteredAt ? new Date(miner.deregisteredAt).toLocaleDateString() : 'No',
      }));
      setMinerData(mappedData);

      // Calculate totals from mappedData
      const totalDaily = mappedData.reduce((sum, item) => sum + parseFloat(item.DailyAlpha || '0'), 0);
      const totalStaking = mappedData.reduce((sum, item) => sum + parseFloat(item.Staking || '0'), 0);
      setTotalDailyAlpha(totalDaily);
      setTotalStakingAlpha(totalStaking);
      setTotalMinerNum(mappedData.length);
      setRegisteredMinerNum(mappedData.filter((m) => m.Registered === 'Yes').length);
      setDeregisteredMinerNum(mappedData.filter((m) => m.Registered === 'No').length);
    } catch (err) {
      setError('Failed to fetch data. Please try again.');
      console.error(err);
    }
    setLoading(false);
  };

  // Reactive calculations for dailyEarn and totalStakingPrice
  useEffect(() => {
    setDailyEarn(totalDailyAlpha * alphaTokenPrice);
    setTotalStakingPrice(totalStakingAlpha * alphaTokenPrice);
  }, [totalDailyAlpha, totalStakingAlpha, alphaTokenPrice]);

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
  }, []); // No dependencies; runs on mount

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

  return (
    <div className="w-full p-4">
      {loading && <p>Loading data...</p>}
      {error && <p className="text-red-500">{error}</p>}
      {success && <p className="text-green-700">{success}</p>}
      <div className="w-full max-w-7xl flex flex-row justify-between items-center mx-auto">
        <div className="w-full flex flex-col items-start">
          <div className="flex flex-col items-center justify-center ubuntu-italic text-black pr-4 md:pr-8 ">
            <div className="text-4xl py-4 font-bold text-red-500 italic">Current Subnet: {currentSubnet || 'Loading...'}</div> {/* Display current */}
            <div className="mb-4 flex flex-row justify-center items-center gap-2 text-lg md:text-xl leading-tight">
              <div>Subnet : </div>
              <input
                type="text"
                value={subnet}
                onChange={e => setSubnet(e.target.value)}
                placeholder="Enter subnet"
                className="border px-2 py-1 rounded"
              />
              <button
                onClick={handleSubnetChange}
                className="bg-blue-500 text-white px-3 py-1 rounded hover:cursor-pointer hover:bg-red-400"
                disabled={loading} // Disable during loading
              >
                Enter
              </button>
            </div>
          </div>
          {/* Rest of the UI (coldkeys, etc.) unchanged */}
          <div className="w-full max-w-xl mb-4 flex gap-2">
            <input
              type="text"
              value={coldKey}
              onChange={e => setColdKey(e.target.value)}
              placeholder="Enter coldkey"
              className="w-full border px-2 py-1 rounded"
            />
            <button
              onClick={handleRegister}
              className="bg-blue-500 text-white px-3 py-1 rounded hover:cursor-pointer hover:bg-red-400"
            >
              Register
            </button>
          </div>
          <div className="w-full max-w-xl mb-4">
            <h2 className="font-bold mb-2">My Coldkeys</h2>
            <ul>
              {registeredKeys.map(key => (
                <li key={key} className="flex items-center justify-between mb-1">
                  <span>{key}</span>
                  <button
                    onClick={() => handleDelete(key)}
                    className="bg-red-500 text-white px-2 py-1 rounded hover:cursor-pointer hover:bg-red-300"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="w-full flex flex-col justify-around items-center gap-4 text-xl">
          <div className='w-full flex flex-row justify-center items-center border-b-2 border-gray-400 pb-4 '>
            <div className="flex flex-col justify-center text-center items-center">
              <h2 className="font-bold mb-2">Alpha Token Price</h2>
              <input
                type="number"
                value={alphaTokenPrice}
                onChange={e => setAlphaTokenPrice(parseFloat(e.target.value) || 0)}
                className="border px-2 py-1 rounded w-36"
                step="0.001"
              />
              
              {/* <div className="text-sm">${alphaTokenPrice.toFixed(2)}</div> */}
            </div>

            <div className='w-full flex flex-col justify-center items-center gap-4'>
              <div className="w-full flex flex-row items-center">
                <div className="w-full flex flex-col items-center">
                  <h2 className="font-bold mb-2">Daily Total Alpha</h2>
                  <div className="text-lg">{totalDailyAlpha.toFixed(2)}</div>
                </div>
                <div className="w-full flex flex-col items-center">
                  <h2 className="font-bold mb-2">Daily Earn</h2>
                  <div className="text-lg">${dailyEarn.toFixed(2)}</div>
                </div>
              </div>

              <div className="w-full flex flex-row items-center">
                <div className="w-full flex flex-col items-center">
                  <h2 className="font-bold mb-2">Total Staking Alpha</h2>
                  <div className="text-lg">
                    {totalStakingAlpha.toFixed(2)}
                  </div>
                </div>
                <div className="w-full flex flex-col items-center">
                  <h2 className="font-bold mb-2">Total Staking Price</h2>
                  <div className="text-lg">${totalStakingPrice.toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>
          <div className='w-full flex flex-row justify-center items-center gap-2'>
            <div className="w-full flex flex-col items-center">
              <h2 className="font-bold mb-2">Total Miners</h2>
              <div className="text-lg">{totalMinerNum}</div>
            </div>
            <div className="w-full flex flex-col items-center">
              <h2 className="font-bold mb-2">Registered Miner</h2>
              <div className="text-lg">{registeredMinerNum}</div>
            </div>
            <div className="w-full flex flex-col items-center">
              <h2 className="font-bold mb-2">Deregistered Miner</h2>
              <div className="text-lg">
                {deregisteredMinerNum}
              </div>          
          </div>
          </div>
          <div className='w-full flex flex-row justify-center items-center gap-2'>
            <div className="w-full flex flex-col items-center">
              <h2 className="font-bold mb-2">Reg Cost</h2>
              <div className="text-lg">{regCost.toFixed(2)}t</div>
            </div>
            <div className="w-full flex flex-col items-center">
              <h2 className="font-bold mb-2">Reg Allowed</h2>
              <div className="text-lg">{regAllowed ? 'Yes' : 'No'}</div>
            </div>
            <div className="w-full flex flex-col items-center">
              <h2 className="font-bold mb-2">Immune Period</h2>
              <div className="text-lg">
                {immunePeriod} ({Math.floor(immunePeriod / 300)}h, {Math.floor((immunePeriod % 300) / 5)}m)
              </div>
            </div>

            {/* <div className="w-full"> 
              <h2 className="font-bold mb-2">Subnet Alpha Price (Emission)</h2>
              <div className="text-lg">{subnetAlphaPrice.toFixed(2)}</div>
            </div> */}
          </div>
        </div>
      </div>
      <Table rowData={minerData} />
    </div>
  );
};

export default Dashboard;
