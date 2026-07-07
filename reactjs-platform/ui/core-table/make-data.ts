import { faker } from '@faker-js/faker';

export type Person = {
  id: number;
  campaign_name: string;
  audience_number: number;
  visits: string;

  createdAt: Date;
};

const range = (len: number) => {
  const arr: number[] = [];
  for (let i = 0; i < len; i++) {
    arr.push(i);
  }
  return arr;
};

const newPerson = (index: number): Person => {
  return {
    id: faker.number.int(1000000) + index,
    campaign_name: faker.person.firstName(),
    audience_number: faker.number.int(40),
    createdAt: faker.date.anytime(),
    visits: faker.lorem.paragraph({ min: 1, max: 3 }),
  };
};

export type EmailItem = {
  id: number;
  full_name: string;
  email: string;
  type: 'UK Buying' | 'UK Renting';
  createdAt: Date;
};

const newEmail = (index: number): EmailItem => {
  return {
    id: faker.number.int(1000000) + index,
    full_name: faker.person.firstName(),
    email: faker.internet.email(),
    type: faker.helpers.shuffle<EmailItem['type']>(['UK Buying', 'UK Renting'])[0]!,
    createdAt: faker.date.anytime(),
  };
};

export function makeData(...lens: number[]) {
  const makeDataLevel = (depth = 0): Person[] => {
    const len = lens[depth]!;
    return range(len).map((d): Person => {
      return {
        ...newPerson(d),
      };
    });
  };

  return makeDataLevel();
}

export function makeDataEmailListSegment(...lens: number[]) {
  const makeDataLevel = (depth = 0): EmailItem[] => {
    const len = lens[depth]!;
    return range(len).map((d): EmailItem => {
      return {
        ...newEmail(d),
      };
    });
  };

  return makeDataLevel();
}
