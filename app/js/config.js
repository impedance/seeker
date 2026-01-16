export const CONFIG = {
  baseURL: 'http://localhost:8080/rest',
  requestTimeout: 30000,
  cacheTTL: 120000,
  pageSize: 100,
  searchDebounce: 300,
  defaultDatabase: 'gesn',
  databases: [
    {
      id: 'gesn',
      name: 'ГЭСН - Строительные работы',
      file: 'ГЭСН.xml',
      description: 'Основные строительные работы'
    },
    {
      id: 'gesnm',
      name: 'ГЭСНм - Монтаж оборудования',
      file: 'ГЭСНм.xml',
      description: 'Монтаж технологического и электротехнического оборудования'
    },
    {
      id: 'gesnmr',
      name: 'ГЭСНмр - Монтаж/демонтаж',
      file: 'ГЭСНмр.xml',
      description: 'Работы по монтажу и демонтажу оборудования'
    },
    {
      id: 'gesnp',
      name: 'ГЭСНп - Промышленное строительство',
      file: 'ГЭСНп.xml',
      description: 'Промышленные и инфраструктурные объекты'
    },
    {
      id: 'gesnr',
      name: 'ГЭСНр - Ремонт',
      file: 'ГЭСНр.xml',
      description: 'Ремонтные работы и дефекты'
    },
    {
      id: 'fsbts_mat',
      name: 'ФСБЦ - Материалы и оборудование',
      file: 'ФСБЦ_Мат&Оборуд.xml',
      description: 'Справочник по материалам и комплектующим'
    },
    {
      id: 'fsbts_mash',
      name: 'ФСБЦ - Машины и механизмы',
      file: 'ФСБЦ_Маш.xml',
      description: 'Справочник по машинам и механизмам'
    }
  ],
  catalogMap: [
    { prefix: '01', database: 'fsbts_mat' },
    { prefix: '91', database: 'fsbts_mash' }
  ]
};
