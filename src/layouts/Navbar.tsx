import React from 'react';
const Navbar: React.FC = () => {
  return (
    <div className="w-full h-15 bg-[#FA660F] flex flex-row justify-between items-center p-4 border-b-2 z-10">
      <div className="md:flex md:justify-center md:items-center">
        <div className="w-[50px] lg:w-[40px] aspect-square ml-14 rounded-full overflow-hidden border-2 border-white">
          <img src="/logo.jpg" alt="logo" className='w-full aspect-square' />
        </div>

      </div>
      <a href="https://t.me/my_miner_alert_bot" className='hover:underline hover:text-white mr-4'>
        Telegram Notification
      </a>
    </div>
  );
};

export default Navbar;
