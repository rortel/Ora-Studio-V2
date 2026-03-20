import svgPaths from "./svg-h3wpkzf5up";
import imgHero1 from "figma:asset/b545abf4495677ce6104da79f57e7f15edcba5a0.png";
import imgWrapperForMultipleRows from "figma:asset/428667e4725cd7048b2e82e2e4f672082e510ef0.png";
import imgBlockAngle1 from "figma:asset/44db6247bc4087ebcdc2af0c2e63430b53186f90.png";
import imgImage1 from "figma:asset/828548c81c7a529d4277b71a4046525cf852a003.png";
import imgIcon11 from "figma:asset/230b57712f829935f228f72848bf5bb6e9c71731.png";
import imgIcon12 from "figma:asset/c4a860a492b53d3f5716a208e85f575e7f1e18de.png";
import imgIcon13 from "figma:asset/32eda534c6c83cc7126cf387befbc63dc25b3959.png";
import imgIcon14 from "figma:asset/a46d76935870c25dd77092bb6135d8035f3df8e8.png";
import imgPhoto1 from "figma:asset/fd1a1304c95304459d525edabe5b548965b73ee0.png";
import imgTitleSubtitleButtonRowForContentColumns from "figma:asset/e770a4caf934a7f0a280cbbe70316b0d298cff32.png";
import { imgGroup } from "./svg-gkco8";

function Navigation() {
  return (
    <div className="content-stretch flex font-['Inter:Regular',sans-serif] font-normal gap-[8px] items-center justify-center leading-[normal] not-italic overflow-clip relative shrink-0 text-[#777] text-[12px] text-center underline whitespace-nowrap" data-name="🍔 Navigation">
      <p className="[text-decoration-skip-ink:none] decoration-solid relative shrink-0">View in the browser</p>
      <p className="[text-decoration-skip-ink:none] decoration-solid relative shrink-0">Unsubscribe</p>
    </div>
  );
}

function ColumnForContentElements() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col items-center justify-center min-h-px min-w-px overflow-clip relative" data-name="🏛️ Column (For Content Elements)">
      <Navigation />
    </div>
  );
}

function PreheaderCenterRowForContentColumns({ className }: { className?: string }) {
  return (
    <div className={className || "bg-white relative shrink-0 w-full"} data-name="🚣 Preheader Center (Row For Content Columns)">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex items-center p-[16px] relative w-full">
          <ColumnForContentElements />
        </div>
      </div>
    </div>
  );
}

function ColumnForContentElements1() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col items-center justify-center min-h-px min-w-px overflow-clip relative" data-name="🏛️ Column (For Content Elements)">
      <div className="h-[504px] relative shrink-0 w-[600px]" data-name="hero 1">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgHero1} />
      </div>
    </div>
  );
}

function FullImageRowForContentColumns({ className }: { className?: string }) {
  return (
    <div className={className || "bg-white content-stretch flex items-center relative shrink-0 w-full"} data-name="🚣 Full Image (Row For Content Columns)">
      <ColumnForContentElements1 />
    </div>
  );
}

function Spacer() {
  return <div className="bg-[rgba(255,255,255,0)] h-[8px] shrink-0 w-full" data-name="📐 Spacer" />;
}

function Button() {
  return (
    <div className="bg-[#c30e29] content-stretch flex items-center justify-center overflow-clip px-[56px] py-[12px] relative rounded-[60px] shrink-0" data-name="🔗 Button">
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[normal] not-italic relative shrink-0 text-[14px] text-center text-white uppercase whitespace-nowrap">Book your service</p>
    </div>
  );
}

function Button1() {
  return (
    <div className="bg-[#14100c] relative rounded-[60px] shrink-0" data-name="🔗 Button">
      <div className="content-stretch flex items-center justify-center overflow-clip px-[66px] py-[12px] relative rounded-[inherit]">
        <p className="font-['Inter:Regular',sans-serif] font-normal leading-[normal] not-italic relative shrink-0 text-[14px] text-center text-white uppercase whitespace-nowrap">Remind Me Later</p>
      </div>
      <div aria-hidden="true" className="absolute border border-[#c30e29] border-solid inset-0 pointer-events-none rounded-[60px]" />
    </div>
  );
}

function ColumnForContentElements2() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col gap-[12px] items-center justify-center min-h-px min-w-px overflow-clip relative" data-name="🏛️ Column (For Content Elements)">
      <p className="font-['Inter:Bold',sans-serif] font-bold leading-[1.21] min-w-full not-italic relative shrink-0 text-[20px] text-center text-white w-[min-content]">Hi Smiles Davis,</p>
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[1.5] min-w-full not-italic relative shrink-0 text-[16px] text-center text-white w-[min-content]">{`As the temperature rises, it's important to keep your vehicle in good working order. Regular servicing improves performance and longevity. A summer service will pick up on any issues and make sure your AC and tyres are in tip top condition.`}</p>
      <Spacer />
      <Button />
      <Button1 />
    </div>
  );
}

function TitleTextButtonRowForContentColumns({ className }: { className?: string }) {
  return (
    <div className={className || "bg-[#0e0b08] relative shrink-0 w-full"} data-name="🚣 Title, Text & Button (Row For Content Columns)">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex items-center px-[40px] py-[32px] relative w-full">
          <ColumnForContentElements2 />
        </div>
      </div>
    </div>
  );
}

function ColumnForContentElements3() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col items-center justify-center min-h-px min-w-px overflow-clip relative" data-name="🏛️ Column (For Content Elements)">
      <div className="h-[30px] relative shrink-0 w-[536px]" data-name="block-angle 1">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgBlockAngle1} />
      </div>
    </div>
  );
}

function RowForContentColumns({ className }: { className?: string }) {
  return (
    <div className={className || "content-stretch flex items-center relative shrink-0 w-full"} data-name="🚣 Row (For Content Columns)">
      <ColumnForContentElements3 />
    </div>
  );
}

function WrapperForMultipleRows() {
  return (
    <div className="relative shrink-0 w-full" data-name="🎁 Wrapper (For Multiple Rows)">
      <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgWrapperForMultipleRows} />
      <div className="flex flex-col items-center overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex flex-col items-center px-[32px] py-[34px] relative w-full">
          <TitleTextButtonRowForContentColumns />
          <RowForContentColumns />
        </div>
      </div>
    </div>
  );
}

function ColumnForContentElements4() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col items-center justify-center min-h-px min-w-px overflow-clip pb-[24px] relative" data-name="🏛️ Column (For Content Elements)">
      <div className="h-[33px] relative shrink-0 w-[600px]" data-name="image 1">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgImage1} />
      </div>
    </div>
  );
}

function FullImageRowForContentColumns1({ className }: { className?: string }) {
  return (
    <div className={className || "bg-white content-stretch flex items-center relative shrink-0 w-full"} data-name="🚣 Full Image (Row For Content Columns)">
      <ColumnForContentElements4 />
    </div>
  );
}

function Spacer1() {
  return <div className="bg-[rgba(255,255,255,0)] h-[4px] shrink-0 w-full" data-name="📐 Spacer" />;
}

function ColumnForContentElements5() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col gap-[8px] items-center justify-center min-h-px min-w-px overflow-clip relative" data-name="🏛️ Column (For Content Elements)">
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[1.21] not-italic relative shrink-0 text-[24px] text-black uppercase w-full">Explore Service Offers</p>
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[1.5] not-italic relative shrink-0 text-[#30332c] text-[18px] w-full">We offer a range of service packages and offers to suit you.</p>
      <Spacer1 />
    </div>
  );
}

function Button2() {
  return (
    <div className="bg-[#c30e29] relative rounded-[60px] shrink-0 w-full" data-name="🔗 Button">
      <div className="flex flex-row items-center justify-center overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex items-center justify-center px-[56px] py-[12px] relative w-full">
          <p className="font-['Inter:Regular',sans-serif] font-normal leading-[normal] not-italic relative shrink-0 text-[14px] text-center text-white uppercase whitespace-nowrap">Discover More</p>
        </div>
      </div>
    </div>
  );
}

function ColumnForContentElements6() {
  return (
    <div className="content-stretch flex flex-col items-center justify-center overflow-clip p-[8px] relative shrink-0 w-[216px]" data-name="🏛️ Column (For Content Elements)">
      <Button2 />
    </div>
  );
}

function TitleTextButtonRowForContentColumns1({ className }: { className?: string }) {
  return (
    <div className={className || "bg-[#fbfbf9] relative shrink-0 w-full"} data-name="🚣 Title, Text & Button (Row For Content Columns)">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex gap-[16px] items-center px-[32px] py-[24px] relative w-full">
          <ColumnForContentElements5 />
          <ColumnForContentElements6 />
        </div>
      </div>
    </div>
  );
}

function ColumnForContentElements7() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col gap-[8px] items-start justify-center leading-[1.14] min-h-px min-w-px not-italic overflow-clip relative text-black text-center uppercase" data-name="🏛️ Column (For Content Elements)">
      <p className="font-['Inter:Regular',sans-serif] font-normal relative shrink-0 text-[18px] w-full">Why choose</p>
      <p className="font-['Inter:Bold',sans-serif] font-bold relative shrink-0 text-[22px] w-full">Nissan Service?</p>
    </div>
  );
}

function HeadingWithParagraphRowForContentColumns({ className }: { className?: string }) {
  return (
    <div className={className || "bg-white relative shrink-0 w-full"} data-name="🚣 Heading With Paragraph (Row For Content Columns)">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex items-center pb-[32px] pt-[48px] px-[32px] relative w-full">
          <ColumnForContentElements7 />
        </div>
      </div>
    </div>
  );
}

function ColumnForContentElements8() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col gap-[6px] items-center justify-center min-h-px min-w-px overflow-clip relative" data-name="🏛️ Column (For Content Elements)">
      <div className="relative shrink-0 size-[95px]" data-name="icon-1 1">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgIcon11} />
      </div>
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-none min-w-full not-italic relative shrink-0 text-[#30332c] text-[18px] text-center uppercase w-[min-content]">Transparent</p>
      <p className="font-['Inter:Bold',sans-serif] font-bold leading-none min-w-full not-italic relative shrink-0 text-[#30332c] text-[18px] text-center uppercase w-[min-content]">Pricing</p>
    </div>
  );
}

function ColumnForContentElements9() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col gap-[6px] items-center justify-center min-h-px min-w-px overflow-clip relative" data-name="🏛️ Column (For Content Elements)">
      <div className="relative shrink-0 size-[95px]" data-name="icon-1 1">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgIcon12} />
      </div>
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-none min-w-full not-italic relative shrink-0 text-[#30332c] text-[18px] text-center uppercase w-[min-content]">Live Service</p>
      <p className="font-['Inter:Bold',sans-serif] font-bold leading-none min-w-full not-italic relative shrink-0 text-[#30332c] text-[18px] text-center uppercase w-[min-content]">Bookings</p>
    </div>
  );
}

function IconStatsRowForContentColumns({ className }: { className?: string }) {
  return (
    <div className={className || "bg-white relative shrink-0 w-full"} data-name="🚣 Icon Stats (Row For Content Columns)">
      <div className="content-stretch flex gap-[16px] items-start pb-[20px] pt-[10px] px-[80px] relative w-full">
        <ColumnForContentElements8 />
        <ColumnForContentElements9 />
      </div>
    </div>
  );
}

function ColumnForContentElements10() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col gap-[6px] items-center justify-center min-h-px min-w-px overflow-clip relative" data-name="🏛️ Column (For Content Elements)">
      <div className="relative shrink-0 size-[95px]" data-name="icon-1 1">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgIcon13} />
      </div>
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-none min-w-full not-italic relative shrink-0 text-[#30332c] text-[18px] text-center uppercase w-[min-content]">Appointment</p>
      <p className="font-['Inter:Bold',sans-serif] font-bold leading-none min-w-full not-italic relative shrink-0 text-[#30332c] text-[18px] text-center uppercase w-[min-content]">Within 24 Hours</p>
    </div>
  );
}

function ColumnForContentElements11() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col gap-[6px] items-center justify-center min-h-px min-w-px overflow-clip relative" data-name="🏛️ Column (For Content Elements)">
      <div className="relative shrink-0 size-[95px]" data-name="icon-1 1">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgIcon14} />
      </div>
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-none min-w-full not-italic relative shrink-0 text-[#30332c] text-[18px] text-center uppercase w-[min-content]">Nissan Express</p>
      <p className="font-['Inter:Bold',sans-serif] font-bold leading-none min-w-full not-italic relative shrink-0 text-[#30332c] text-[18px] text-center uppercase w-[min-content]">Service</p>
    </div>
  );
}

function ColumnForContentElements12() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col gap-[8px] items-start justify-center leading-[1.14] min-h-px min-w-px not-italic overflow-clip relative text-black text-center uppercase" data-name="🏛️ Column (For Content Elements)">
      <p className="font-['Inter:Regular',sans-serif] font-normal relative shrink-0 text-[18px] w-full">trust your vehicle</p>
      <p className="font-['Inter:Bold',sans-serif] font-bold relative shrink-0 text-[22px] w-full">With the people who know it best</p>
    </div>
  );
}

function Button3() {
  return (
    <div className="bg-[#c30e29] content-stretch flex items-center justify-center overflow-clip px-[56px] py-[12px] relative rounded-[60px] shrink-0" data-name="🔗 Button">
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[normal] not-italic relative shrink-0 text-[14px] text-center text-white uppercase whitespace-nowrap">Discover More</p>
    </div>
  );
}

function ColumnForContentElements13() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col gap-[24px] items-center justify-center min-h-px min-w-px overflow-clip relative" data-name="🏛️ Column (For Content Elements)">
      <div className="h-[317px] relative shrink-0 w-[524px]" data-name="photo 1">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgPhoto1} />
      </div>
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[1.5] min-w-full not-italic relative shrink-0 text-[#30332c] text-[18px] text-center w-[min-content]">{`Our highly trained Nissan certified technicians know your vehicle. You can expect a warm welcome and only the soundest advice. We'll inspect cooling system, battery, AC system, air filter, engine belt and all fluids and make recommendations so you can make a well‑informed decision on how to move forward.`}</p>
      <Button3 />
    </div>
  );
}

function TextButtonRowForContentColumns({ className }: { className?: string }) {
  return (
    <div className={className || "bg-white relative shrink-0 w-full"} data-name="🚣 Text & Button (Row For Content Columns)">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex items-center pb-[40px] px-[16px] relative w-full">
          <ColumnForContentElements13 />
        </div>
      </div>
    </div>
  );
}

function Spacer2() {
  return <div className="bg-[rgba(255,255,255,0)] h-[16px] shrink-0 w-full" data-name="📐 Spacer" />;
}

function Button4() {
  return (
    <div className="bg-[#c30e29] content-stretch flex items-center justify-center overflow-clip px-[56px] py-[12px] relative rounded-[60px] shrink-0" data-name="🔗 Button">
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[normal] not-italic relative shrink-0 text-[14px] text-center text-white uppercase whitespace-nowrap">Book Now</p>
    </div>
  );
}

function ColumnForContentElements14() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col gap-[8px] items-center justify-center min-h-px min-w-px overflow-clip relative" data-name="🏛️ Column (For Content Elements)">
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[1.14] min-w-full not-italic relative shrink-0 text-[22px] text-center text-white uppercase w-[min-content]">Get your nissan fit for summer</p>
      <p className="font-['Inter:Bold',sans-serif] font-bold leading-[1.14] min-w-full not-italic relative shrink-0 text-[22px] text-center text-white uppercase w-[min-content]">With the people who know it best</p>
      <Spacer2 />
      <Button4 />
    </div>
  );
}

function TitleSubtitleButtonRowForContentColumns({ className }: { className?: string }) {
  return (
    <div className={className || "relative shrink-0 w-full"} data-name="🚣 Title, Subtitle & Button (Row For Content Columns)">
      <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgTitleSubtitleButtonRowForContentColumns} />
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex items-center px-[16px] py-[112px] relative w-full">
          <ColumnForContentElements14 />
        </div>
      </div>
    </div>
  );
}

function ColumnForContentElements15() {
  return (
    <div className="flex-[1_0_0] min-h-px min-w-px relative" data-name="🏛️ Column (For Content Elements)">
      <div className="flex flex-col justify-center overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex flex-col items-start justify-center px-[30px] py-[20px] relative w-full">
          <p className="font-['Inter:Regular',sans-serif] font-normal leading-[1.5] not-italic relative shrink-0 text-[13px] text-white w-full">© Arabian Automobiles Company 2023</p>
        </div>
      </div>
    </div>
  );
}

function SocialIconLink() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="🔗 Social Icon Link">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g id="ð Social Icon Link">
          <path d={svgPaths.p16dd4500} fill="var(--fill-0, white)" id="Vector" />
        </g>
      </svg>
    </div>
  );
}

function SocialIconLink1() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="🔗 Social Icon Link">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g clipPath="url(#clip0_557_111)" id="ð Social Icon Link">
          <path d={svgPaths.p9d76b80} fill="var(--fill-0, white)" id="Vector" />
        </g>
        <defs>
          <clipPath id="clip0_557_111">
            <rect fill="white" height="20" width="20" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function SocialIconLink2() {
  return (
    <div className="relative shrink-0 size-[20px]" data-name="🔗 Social Icon Link">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 20 20">
        <g clipPath="url(#clip0_557_108)" id="ð Social Icon Link">
          <path d={svgPaths.p28bc780} fill="var(--fill-0, white)" id="Vector" />
        </g>
        <defs>
          <clipPath id="clip0_557_108">
            <rect fill="white" height="20" width="20" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Group() {
  return (
    <div className="absolute inset-[6.12%_0.78%_6.13%_1.16%] mask-alpha mask-intersect mask-no-clip mask-no-repeat mask-position-[-0.232px_-0.224px] mask-size-[20px_18px]" data-name="Group" style={{ maskImage: `url('${imgGroup}')` }}>
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 19.611 17.551">
        <g id="Group">
          <path d={svgPaths.p11f1a300} fill="var(--fill-0, white)" id="Vector" />
        </g>
      </svg>
    </div>
  );
}

function ClipPathGroup() {
  return (
    <div className="absolute contents inset-[5%_0]" data-name="Clip path group">
      <Group />
    </div>
  );
}

function SocialIconLink3() {
  return (
    <div className="overflow-clip relative shrink-0 size-[20px]" data-name="🔗 Social Icon Link">
      <ClipPathGroup />
    </div>
  );
}

function Social() {
  return (
    <div className="content-stretch flex gap-[16px] items-center overflow-clip relative shrink-0" data-name="🐦 Social">
      <SocialIconLink />
      <SocialIconLink1 />
      <SocialIconLink2 />
      <SocialIconLink3 />
    </div>
  );
}

function ColumnForContentElements16() {
  return (
    <div className="bg-[#c30e29] content-stretch flex flex-col items-center justify-center overflow-clip px-[30px] py-[20px] relative shrink-0" data-name="🏛️ Column (For Content Elements)">
      <Social />
    </div>
  );
}

function FooterSocialRowForContentColumns({ className }: { className?: string }) {
  return (
    <div className={className || "bg-[#292728] content-stretch flex items-center relative shrink-0 w-full"} data-name="🚣 Footer Social (Row For Content Columns)">
      <ColumnForContentElements15 />
      <ColumnForContentElements16 />
    </div>
  );
}

function Navigation1() {
  return (
    <div className="content-stretch flex font-['Inter:Regular',sans-serif] font-normal gap-[8px] items-center justify-center leading-[normal] not-italic overflow-clip relative shrink-0 text-[#4d4d4d] text-[13px] text-center underline whitespace-nowrap" data-name="🍔 Navigation">
      <p className="[text-decoration-skip-ink:none] decoration-solid relative shrink-0">Unsubscribe</p>
      <p className="[text-decoration-skip-ink:none] decoration-solid relative shrink-0">View in the browser</p>
    </div>
  );
}

function ColumnForContentElements17() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col items-center justify-center min-h-px min-w-px overflow-clip relative" data-name="🏛️ Column (For Content Elements)">
      <Navigation1 />
    </div>
  );
}

function FooterUnsubscribeRowForContentColumns({ className }: { className?: string }) {
  return (
    <div className={className || "bg-white relative shrink-0 w-full"} data-name="🚣 Footer Unsubscribe (Row For Content Columns)">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex items-center p-[16px] relative w-full">
          <ColumnForContentElements17 />
        </div>
      </div>
    </div>
  );
}

export default function EmailifyTemplate() {
  return (
    <div className="bg-white content-stretch flex flex-col items-start relative size-full" data-name="✉️ Emailify Template">
      <PreheaderCenterRowForContentColumns />
      <FullImageRowForContentColumns />
      <WrapperForMultipleRows />
      <FullImageRowForContentColumns1 />
      <TitleTextButtonRowForContentColumns1 />
      <HeadingWithParagraphRowForContentColumns />
      <IconStatsRowForContentColumns />
      <div className="bg-white relative shrink-0 w-full" data-name="🚣 Icon Stats (Row For Content Columns)">
        <div className="content-stretch flex gap-[16px] items-start pb-[20px] pt-[10px] px-[80px] relative w-full">
          <ColumnForContentElements10 />
          <ColumnForContentElements11 />
        </div>
      </div>
      <div className="bg-white relative shrink-0 w-full" data-name="🚣 Heading With Paragraph (Row For Content Columns)">
        <div className="flex flex-row items-center size-full">
          <div className="content-stretch flex items-center pb-[32px] pt-[48px] px-[32px] relative w-full">
            <ColumnForContentElements12 />
          </div>
        </div>
      </div>
      <TextButtonRowForContentColumns />
      <TitleSubtitleButtonRowForContentColumns />
      <FooterSocialRowForContentColumns />
      <FooterUnsubscribeRowForContentColumns />
    </div>
  );
}