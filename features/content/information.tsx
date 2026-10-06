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
        'Our edit keeps growing, one considered piece at a time. New arrivals are added through the season, so there is always something fresh to discover alongside the favourites you come back to.',
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
        'Our customer care team is here to help with sizing, product questions and anything to do with your order. Whenever you get in touch, include the order reference from your confirmation email so we can help you quickly.',
      ],
      [
        'An existing order',
        'Signed-in customers can find their order information in their account. Guest orders can be revisited in the browser used at checkout using the order reference.',
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
        'How do I pay?',
        'Pay by card or bank account at checkout. Your order total, including delivery, is shown in Naira before you confirm, and you will receive a confirmation email once your order is placed.',
      ],
      [
        'How do I find my size?',
        'Check the size options and product details for each piece. Sizing can differ from style to style, so take a moment with the details before you choose.',
      ],
      [
        'Where do you deliver?',
        'We deliver to addresses in Nigeria. The delivery options, charges and estimated timelines for your state are shown at checkout before you pay.',
      ],
      [
        'What if a piece is sold out?',
        'Unavailable combinations cannot be added to your bag. Stock is checked again when an order is created. Putting a piece in your bag does not reserve it.',
      ],
    ],
  },
  delivery: {
    title: 'From our edit to your door.',
    intro: 'Everything you need to know about getting your order home.',
    sections: [
      [
        'Where we deliver',
        'We deliver within Nigeria. The states we currently serve are shown as delivery options at checkout.',
      ],
      [
        'Charges and timelines',
        'Delivery times and charges for your state are shown at checkout before you pay. Where free delivery applies, it is shown clearly in your order summary.',
      ],
      [
        'Your delivery details',
        'Please provide the recipient’s name, Nigerian phone number, state, city or town, address and, where useful, LGA and landmark. Delivery instructions help the courier locate your address but cannot guarantee a specific arrival time.',
      ],
      [
        'Dispatch and delays',
        'We prepare your order for dispatch as soon as it is confirmed. If something holds up your delivery, customer care will keep you updated. Signed-in customers can check their order status in their account at any time.',
      ],
    ],
  },
  returns: {
    title: 'Room to reconsider.',
    intro: 'If something is not quite right, here is how we can help.',
    sections: [
      [
        'Before you request a return',
        'Contact customer care with your order reference, the item you would like to return and the reason for your request. We will confirm whether the item can be returned and where to send it. Please wait for our confirmation before sending anything back.',
      ],
      [
        'Item condition and exclusions',
        'Items should be returned unworn, unwashed and with their original tags and packaging. For hygiene reasons, some pieces, such as jewellery, may not be returnable unless faulty. Any exclusions do not affect your rights under applicable consumer law.',
      ],
      [
        'Wrong, damaged or faulty items',
        'Please keep the packaging and contact customer care promptly with your order reference and a description of the issue. We will look into it and explain the available remedy, in line with your rights under applicable law.',
      ],
      [
        'Return costs and refunds',
        'Once your return is received and checked, we will let you know the outcome. Approved refunds are made to your original payment method.',
      ],
    ],
  },
  privacy: {
    title: 'Your information, thoughtfully handled.',
    intro: 'How we use and look after the information you share with us.',
    sections: [
      [
        'Who is responsible',
        'The Oreva Edit is responsible for the personal information collected through this store. To ask a question about your information, contact customer care with your request.',
      ],
      [
        'Information we use',
        'Guest checkout asks for contact and delivery details. Accounts use Supabase Auth and may receive your Google account identifier, name and email when you choose Google sign-in. We store order details, saved addresses, wishlist choices and essential security records to operate the store. Card and bank details typed at checkout are used only in your browser to complete the payment step; they are not sent to or stored by The Oreva Edit.',
      ],
      [
        'Why and with whom',
        'Information is used to manage accounts, provide requested shopping services, fulfil orders and respond to support and security issues. We use Supabase for hosting, authentication and storage, Mailgun for order emails, our hosting provider, and delivery partners who need your delivery details to bring your order to you.',
      ],
      [
        'Cookies',
        'Essential authentication cookies maintain your session. An HttpOnly guest cookie protects access to guest orders and identifies a guest’s bag and wishlist, which we store on our servers and delete after 30 days without changes. Signed-in bags and wishlists are saved to your account. There are no optional analytics or advertising scripts, and no optional tracking is pre-enabled. Clearing cookies starts a new guest bag and removes guest order access.',
      ],
      [
        'Your choices and rights',
        'Use account settings to update profile and addresses, and sign out on shared devices. To request access, correction or deletion of your information, or to raise a concern, contact customer care. Information required for legitimate order records may need to be retained.',
      ],
    ],
  },
  terms: {
    title: 'The terms of the edit.',
    intro: 'The terms that apply when you shop with The Oreva Edit.',
    sections: [
      [
        'About this store',
        'The Oreva Edit is an online fashion retailer serving customers in Nigeria. By using this store and placing an order, you agree to these terms.',
      ],
      [
        'Products and prices',
        'Prices are shown in Nigerian Naira. Delivery charges are shown separately before you confirm your order. Products may have size, colour or other options, and availability is checked when you order. We take care to show each piece accurately, though colours can look slightly different from screen to screen.',
      ],
      [
        'Orders and acceptance',
        'Placing an order is a request to purchase, subject to availability. Order, payment and delivery statuses are tracked separately, and we will keep you informed if anything affects your order.',
      ],
      [
        'Accounts and acceptable use',
        'Provide accurate information for real services and protect access to your account. Do not attempt unauthorised access, interfere with service operation, submit malicious content or misuse another person’s information. You may shop as a guest.',
      ],
      [
        'Delivery, returns and disputes',
        'Please read our delivery and returns pages before you buy. If you have a concern about an order, contact customer care and we will work with you to resolve it. Nothing in these terms limits your rights under applicable consumer law.',
      ],
      [
        'Promotions and changes',
        'Promotions come with clear terms, eligibility and dates. We may update these terms from time to time; orders already placed are handled under the terms that applied when you ordered.',
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
