import Link from 'next/link';
export const information: Record<
  string,
  { title: string; intro: string; sections: [string, string][] }
> = {
  about: {
    title: 'An everyday point of view.',
    intro:
      'The Oreva Edit is a Nigerian fashion retailer with a simple starting point: good pieces should have a place in real life.',
    sections: [
      [
        'A considered wardrobe',
        'Clothing, shoes and accessories for women, men and little ones. Our edit makes room for different tastes, changing plans and the pieces you make your own.',
      ],
      [
        'Your style, your say',
        'We believe a wardrobe is personal. We bring the edit; you bring the point of view. From the first layer to the finishing detail, the choice is yours.',
      ],
      [
        'The next chapter',
        'We are preparing our first catalogue. The pieces and photography in this development preview are samples. Real product specifications, stock, service details and approved brand assets will be published before launch.',
      ],
    ],
  },
  contact: {
    title: 'Let’s talk.',
    intro:
      'A question about a piece, your size or an order? We want the answer to be easy to find.',
    sections: [
      [
        'Customer care',
        'Our customer care email, phone number, WhatsApp contact and opening hours are being confirmed. Direct contact is not yet available in this development preview. No enquiry is sent from this page.',
      ],
      [
        'An existing order',
        'Signed-in customers can find their order information in their account. Guest test orders can be revisited in the browser used at checkout using the order reference.',
      ],
      [
        'Business details',
        'Legal entity: [OWNER TO SUPPLY]. Registered address: [OWNER TO SUPPLY]. CAC registration number, where applicable: [OWNER TO SUPPLY].',
      ],
    ],
  },
  faq: {
    title: 'A few useful answers.',
    intro: 'The details that make shopping feel a little simpler.',
    sections: [
      [
        'Do I need an account?',
        'No. Guest checkout is supported. An account gives you saved addresses, order history and a wishlist across your devices.',
      ],
      [
        'Can I pay for an order now?',
        'No. Payments are not connected in this phase. Development checkout creates an unpaid test order; it does not collect money, reserve real stock or arrange delivery.',
      ],
      [
        'How do I find my size?',
        'Check the options and product details for each piece. Sizing differs by style and supplier. Verified measurements and footwear sizing systems must be provided with the production catalogue.',
      ],
      [
        'Where do you deliver?',
        'The platform is designed for Nigerian addresses. Available delivery zones, prices and estimated timelines will be confirmed before launch. Development rates are samples, not service commitments.',
      ],
      [
        'What if a piece is sold out?',
        'Unavailable combinations cannot be added to your bag. Stock is checked again when an order is created. Putting a piece in your bag does not reserve it.',
      ],
    ],
  },
  delivery: {
    title: 'From our edit to your door.',
    intro:
      'Delivery policy — starter draft. Business approval is required before this policy can apply to real orders.',
    sections: [
      [
        'Where we deliver',
        'The store is designed to serve Nigeria. Serviceable states, LGAs and courier arrangements are [OWNER TO CONFIRM]. Availability is determined by the delivery zones shown at checkout.',
      ],
      [
        'Charges and timelines',
        'Charges are calculated from the selected delivery zone and displayed before an order is submitted. Any free-delivery threshold must be expressly displayed. Development rates and dates are labelled as samples and are not business policy.',
      ],
      [
        'Your delivery details',
        'Please provide the recipient’s name, Nigerian phone number, state, city or town, address and, where useful, LGA and landmark. Delivery instructions help the courier locate your address but cannot guarantee a specific arrival time.',
      ],
      [
        'Dispatch and delays',
        'The final dispatch schedule, tracking provider, delivery attempts, remote-area arrangements and lost-parcel process are [OWNER TO CONFIRM]. If an actual order is delayed, the final customer care channel will provide an update.',
      ],
      [
        'This phase',
        'No real payments or deliveries are accepted through development checkout. A test order does not create a delivery commitment.',
      ],
    ],
  },
  returns: {
    title: 'Room to reconsider.',
    intro:
      'Returns & refunds policy — starter draft, subject to business and qualified Nigerian legal review.',
    sections: [
      [
        'Before you request a return',
        'The return window is [OWNER TO CONFIRM]. Contact [SUPPORT EMAIL TO BE SUPPLIED] with your order reference, the affected item and the reason for your request. Do not send goods to an unconfirmed return address.',
      ],
      [
        'Item condition and exclusions',
        'The business must confirm requirements for unworn items, tags, packaging, footwear, hygiene-sensitive products, jewellery and customised products. Any exclusions must be clearly disclosed before purchase and remain subject to applicable consumer rights.',
      ],
      [
        'Wrong, damaged or faulty items',
        'Please retain the packaging and contact customer care promptly with a description of the issue. The business will assess the issue and explain the available remedy in accordance with the final policy and applicable law. No claim is made here that statutory rights are limited.',
      ],
      [
        'Return costs and refunds',
        'Responsibility for return shipping, inspection timelines, exchange options, original delivery charge treatment and refund times are [OWNER TO CONFIRM]. Refunds will only be recorded after provider confirmation when payments are integrated.',
      ],
      [
        'Development orders',
        'There is no money to refund for unpaid test orders. No physical return should be arranged for development catalogue samples.',
      ],
    ],
  },
  privacy: {
    title: 'Your information, thoughtfully handled.',
    intro:
      'Privacy & storage notice — starter draft. The legal entity and its data protection contact must be supplied before launch.',
    sections: [
      [
        'Who is responsible',
        'Data controller: [LEGAL ENTITY NAME]. Registered address: [ADDRESS]. Privacy contact: [EMAIL]. These details and the applicable retention periods require owner approval and qualified Nigerian legal review.',
      ],
      [
        'Information we use',
        'Guest checkout asks for contact and delivery details. Accounts use Supabase Auth and may receive your Google account identifier, name and email when you choose Google sign-in. We store order details, saved addresses, wishlist choices and essential security records to operate the store. Card data is not collected in this phase.',
      ],
      [
        'Why and with whom',
        'Information is used to manage accounts, provide requested shopping services, fulfil orders when launched, and respond to support and security issues. Proposed processors include Supabase for hosting/authentication/storage, Mailgun for transactional email, the deployment host and approved couriers. Legal bases, international transfers and processor agreements must be confirmed before live processing.',
      ],
      [
        'Cookies and local storage',
        'Essential authentication cookies maintain your session. An HttpOnly guest cookie protects access to guest orders. Bag and wishlist choices use local storage on your device and sync to your account when signed in. There are no optional analytics or advertising scripts, and no optional tracking is pre-enabled. Clearing storage may remove guest shopping choices and guest order access.',
      ],
      [
        'Your choices and rights',
        'Use account settings to update profile and addresses, and sign out on shared devices. To request access, correction, deletion or raise a concern, contact the privacy email once confirmed. Applicable rights, response timelines, retention and complaint routes must be explained in the reviewed policy. Information required for legitimate order records may need to be retained.',
      ],
      [
        'Development preview',
        'Do not enter real customer information into fixture checkout. Use synthetic test details. Local development order files must not be deployed or committed.',
      ],
    ],
  },
  terms: {
    title: 'The terms of the edit.',
    intro:
      'Terms & conditions — substantive starter draft, not professionally reviewed legal advice or a final trading policy.',
    sections: [
      [
        'About this store',
        'The Oreva Edit is operated by [LEGAL ENTITY NAME], of [REGISTERED ADDRESS], CAC [NUMBER WHERE APPLICABLE]. Support: [EMAIL AND PHONE]. These facts must be confirmed before the store accepts real orders.',
      ],
      [
        'Products and prices',
        'Prices are shown in Nigerian Naira. Delivery charges are presented separately before submission. Products may have size, colour or other variants, and availability is checked during ordering. Production photographs and descriptions must accurately represent actual items. Development images, prices and stock are placeholders.',
      ],
      [
        'Orders and acceptance',
        'Submitting an order is a request to purchase, subject to confirmed availability and the final acceptance process. Order, payment and fulfilment statuses are separate. An order reference or received email alone does not establish that payment was collected or goods dispatched.',
      ],
      [
        'Development checkout',
        'This phase has no payment provider. Test checkout creates unpaid development records only. It does not charge you, complete a sale, or arrange shipment. Real checkout must remain disabled until business and technical launch requirements are met.',
      ],
      [
        'Accounts and acceptable use',
        'Provide accurate information for real services and protect access to your account. Do not attempt unauthorised access, interfere with service operation, submit malicious content or misuse another person’s information. You may shop as a guest.',
      ],
      [
        'Delivery, returns and disputes',
        'Read the delivery and returns pages before purchasing once trading begins. Final cancellation rules, delivery responsibilities, returns, refunds, complaint handling and dispute provisions require owner and legal approval. Nothing in the reviewed terms should unlawfully exclude consumer rights.',
      ],
      [
        'Promotions and changes',
        'Promotions must have genuine terms, eligibility and dates. No fictitious discount or urgency is used. Material changes to final policies should be dated and published; existing orders should be handled under their applicable agreed terms.',
      ],
    ],
  },
};
export function InformationPage({ slug }: { slug: string }) {
  const p = information[slug];
  return (
    <div className="container">
      <article className="content-page">
        <span className="eyebrow">THE OREVA EDIT / GOOD TO KNOW</span>
        <h1>{p.title}</h1>
        <p>{p.intro}</p>
        {p.sections.map(([heading, text]) => (
          <section key={heading}>
            <h2>{heading}</h2>
            <p>{text}</p>
          </section>
        ))}
        <Link href={slug === 'contact' ? '/account/orders' : '/shop'} className="text-link">
          {slug === 'contact' ? 'View your orders' : 'Back to the edit'}
        </Link>
      </article>
    </div>
  );
}
