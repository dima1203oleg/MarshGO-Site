# Референси MARSHGO з ТЗ від 13.10.2026

Ці вісім JPEG збережені побайтно з повідомлення користувача. Вони задають візуальні вимоги для navigation, multimodal results, route map/details і transport legend. Текст і числові значення на макетах є прикладами, не production даними.

| Фото | SHA-256 | Візуальна роль | Відповідність наявним еталонам |
|---|---|---|---|
| [Фото 1](./1-Фото-1.jpg) | f9d4b61d267cb7ada6041d43f5ebab1c6b434ae8fb7f35e758f4c332bda0505f | Світлі navigation overview, route preview, active maneuver і layer sheet | Новий еталон навігації |
| [Фото 2](./2-Фото-2.jpg) | 93d3c8db8eadedb3d3ae339be40a87adfcd097633f37d1b3d4edfed68b1b1df9 | Розгорнуті dark route details | Побайтно збігається з route-map-bottom-sheet/06 |
| [Фото 3](./3-Фото-3.jpg) | c029db8f7f0afcd55649ae66d2b29a791d13b8e8c558710546427fad0b9da8ee | Dark half sheet із компактними legs | Побайтно збігається з route-map-bottom-sheet/07 |
| [Фото 4](./4-Фото-4.jpg) | 104dae85afe60d83b66040006f0628f166e790248f96ca13ababb4a23899a884 | Dark collapsed map summary | Побайтно збігається з route-map-bottom-sheet/08 |
| [Фото 5](./5-Фото-5.jpg) | ed3954cce34fa604d6d14570b533b242ebb3b8c089f0a00b7503de408a9b6e00 | Dark results cards і три strategies | Побайтно збігається з journey-search-results/03 |
| [Фото 6](./6-Фото-6.jpg) | 81ec8c9049a12a29b093faa0b6d0977f3102e16c4a90e9c8e696debf7d5862a5 | Light/dark results і 12-mode catalogue | Побайтно збігається з journey-search-results/01 |
| [Фото 7](./7-Фото-7.jpg) | 2cd6bf47ad92f9ece3622a29803286148e1d2fbe21f76c6995fe3bffb7286259 | Light results і transport/icon legend | Побайтно збігається з journey-search-results/02 |
| [Фото 8](./8-Фото-8.jpg) | ddf757b52ad00fc36e93b1fe1c45ea519b6612b94f30a0fafb98e163f9f6aa08 | Light/dark results та action/mode icon legend | Новий комбінований еталон |

Фото 2–7 вже hash-locked в окремих канонічних папках Site. Ці копії зберігають повний набір саме так, як його отримано. Фото 1 і 8 додають нові стани/пояснення. Батьківський canonical README визначає, як ці референси поєднуються з раніше затвердженими дошками.

Golden screenshot треба робити з crop самого UI у відповідному viewport. Не порівнювати рамку телефону, галерею iOS або поля навколо макета. Не робити з JPEG background чи runtime screen.
