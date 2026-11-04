import 'package:flutter_test/flutter_test.dart';

import 'package:itpark_academy/l10n.dart';
import 'package:itpark_academy/models.dart';
import 'package:itpark_academy/widgets/common.dart';

void main() {
  test('localized falls back to the default field', () {
    final json = {'title': 'Asoslar', 'title_uz': 'Asoslar', 'title_ru': 'Основы'};
    expect(localized(json, 'title', 'ru'), 'Основы');
    expect(localized(json, 'title', 'uz'), 'Asoslar');
    expect(localized({'title': 'Fallback'}, 'title', 'ru'), 'Fallback');
  });

  test('course parses sections and lessons', () {
    final course = Course.fromJson({
      'id': 1,
      'slug': 'test',
      'title': 'Test',
      'title_uz': 'Test',
      'title_ru': 'Тест',
      'short_description': 'Short',
      'description': 'Long',
      'is_free': true,
      'sections': [
        {
          'id': 2,
          'title': 'Section',
          'order': 0,
          'lessons': [
            {
              'id': 3,
              'title': 'Lesson',
              'order': 0,
              'duration_seconds': 60,
              'has_video': true,
            }
          ]
        }
      ]
    }, 'uz');
    expect(course.title, 'Test');
    expect(course.sections.single.title, 'Section');
    expect(course.sections.single.lessons.single.id, 3);
  });

  test('number formatting groups thousands', () {
    expect(formatNumber(1250000), '1 250 000');
    expect(formatNumber(45), '45');
  });

  test('language labels are translated', () {
    expect(const L('uz').myLearning, "O‘qishim");
    expect(const L('ru').myLearning, 'Моё обучение');
  });
}
